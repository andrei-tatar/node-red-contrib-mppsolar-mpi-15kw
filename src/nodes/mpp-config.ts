import { merge, ReplaySubject, Subject, throwError, timer } from 'rxjs';
import { debounceTime, first, ignoreElements, share, switchMap } from 'rxjs/operators';
import { ConfigNode, NodeInterface } from '..';
import { Mpp } from '../communication/mpp';
import { logger } from '../log';

module.exports = function (RED: any) {
    RED.nodes.registerType('mpp-config',
        function (this: NodeInterface & ConfigNode, config: any) {
            RED.nodes.createNode(this, config);

            let path: string | undefined;
            if (typeof config.path === 'string') {
                path = config.path.trim() || undefined;
            }
            if (!path) {
                return;
            }

            const reset$ = new Subject<void>();
            const log = logger?.scope(`config`);

            this.mpp$ = merge(
                Mpp.create(path, log),
                reset$.pipe(
                    debounceTime(1000),
                    first(),
                    switchMap(_ =>
                        throwError(() => {
                            log?.trace('reseting connection');
                            return new Error('Reset connection');
                        })
                    ),
                    ignoreElements(),
                ),
            ).pipe(
                share({
                    connector: () => new ReplaySubject(1),
                }),
            );
        });
};
