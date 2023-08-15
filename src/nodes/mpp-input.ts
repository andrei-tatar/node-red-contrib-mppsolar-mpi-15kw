import { combineLatest, concat, defer, interval, EMPTY, Subject, merge, Observable, throwError, timer } from 'rxjs';
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

            concat(
                defer(() => {
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

                    return merge(...queries$);
                }),
                tap(v => {
                    log?.trace('got response', { value: v });
                    this.status({});
                }),
                catchError((err) => {
                    this.status({ fill: 'red', text: `${err}` })
                    return throwError(() => err);
                }),
                finalize(() => {
                    log?.trace('disconnected');
                    this.status({ fill: 'red', text: 'disconnected' });
                }),
                retry({
                    resetOnSuccess: true,
                    delay: (_, retryCount) => {
                        const delay = Math.min(30000, 500 * Math.pow(2, retryCount));
                        return timer(delay);
                    },
                }),
                takeUntil(close$),
            ).subscribe({
                next: (msg) => this.send(msg),
                complete: () => log?.trace('complete!'),
            });

            this.on('close', () => close$.next());
        });
};
