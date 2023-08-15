import { combineLatest, concat, defer, interval, EMPTY, Subject, merge, Observable } from 'rxjs';
import { finalize, catchError, startWith, tap, retry, takeUntil, concatMap, map } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { logger } from '../log';

type AvailableQueries =
    'ProtocolId' |
    'SeriesNumber' |
    'CpuVersion' |
    '2ndCpuVersion' |
    'DeviceModel' |
    'RatedInformation' |
    'GeneralStatus' |
    'PowerStatus' |
    'WorkingMode' |
    'WarningStatus' |
    'Flags';

module.exports = function (RED: any) {
    RED.nodes.registerType('mpp-input',
        function (this: NodeInterface, config: any) {
            RED.nodes.createNode(this, config);

            const mppConfig: ConfigNode = RED.nodes.getNode(config.mpp);
            if (!mppConfig?.mpp$) {
                return;
            }
            const query: AvailableQueries[] = config.query?.split(',') ?? [];
            if (!query.length) {
                return;
            }

            const log = logger?.scope(`reg-${config.id}`);

            let timeoutMsec = (+config.timeout || 3) * 1000;
            const intervalMsec = (+config.interval || 10) * 1000;
            const close$ = new Subject<void>();
            let consecutiveErrors = 0;

            const resetConnectionOnConsecutiveErrors = () => {
                if (++consecutiveErrors >= 3) {
                    log?.trace('3 consecutive errors, reseting config');
                    mppConfig.reset();
                };
            };

            concat(
                defer(() => {
                    consecutiveErrors = 0;
                    log?.trace('starting subscription');
                    this.status({ fill: 'yellow', text: 'standby' })
                    return EMPTY;
                }),
                combineLatest([
                    mppConfig.mpp$,
                    interval(intervalMsec).pipe(startWith(0)),
                ])
            ).pipe(
                concatMap(([n]) => {
                    log?.trace('reading');
                    this.status({ fill: 'blue' });

                    const queries$ = query.map(queryType => {
                        const query$: Observable<any> = n[`query${queryType}`](timeoutMsec);
                        return query$.pipe(
                            map(v => ({
                                payload: v,
                                topic: queryType.replace(/([a-z])([A-Z])/gm, (_, p1, p2) => `${p1}-${p2}`).toLocaleLowerCase(),
                            })),
                        );
                    });

                    const result = merge(...queries$)
                        .pipe(
                            catchError(err => {
                                log?.trace('error reading');
                                this.warn(`Error reading ${config.register}: ${err}`);
                                this.status({ fill: 'red', text: `${err}` })
                                resetConnectionOnConsecutiveErrors();
                                return EMPTY;
                            })
                        );
                    return result;
                }),
                tap(v => {
                    log?.trace('got response', { value: v });
                    this.status({});
                    consecutiveErrors = 0;
                }),
                finalize(() => {
                    log?.trace('disconnected');
                    this.status({ fill: 'red', text: 'disconnected' });
                }),
                retry({ delay: 20000 }),
                takeUntil(close$),
            ).subscribe({
                next: (msg) => this.send(msg),
                complete: () => log?.trace('complete!'),
            });

            this.on('close', () => close$.next());
        });
};
