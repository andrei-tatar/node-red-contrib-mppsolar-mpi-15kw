import { connectable, merge, Observable, Subject, Connectable, EMPTY, race } from 'rxjs';
import { SerialCommunication } from './serial';
import { concatMap, first, ignoreElements, scan, share, timeout } from 'rxjs/operators';

const PCKG_START = 0x5e;
const PCKG_END = 0x0d;

export class PackageCommunication {
    private readonly packages$: Observable<string>;
    private readonly work$ = new Subject<Work>();

    private readonly doWork$ = this.work$.pipe(
        concatMap(v => {
            if (v.ignore) {
                return EMPTY;
            }

            const progress = new Subject();
            v.observable.subscribe(progress);
            v.observable.connect();
            return progress;
        }),
        ignoreElements(),
        share(),
    )

    constructor(
        private readonly serial: SerialCommunication,
    ) {
        this.packages$ = this.serial.data$.pipe(
            scan(PackageCommunication.handleMessage, { items: [], pending: Buffer.alloc(0) } as ParseInputState),
            concatMap(v => v.items),
            share({ resetOnRefCountZero: true }),
        );
    }

    private static handleMessage(state: ParseInputState, msg: Buffer) {
        state.pending = state.pending
            ? Buffer.concat([state.pending, msg])
            : msg;

        state.items = [];

        let found = false;;
        do {
            const startIndex = state.pending.indexOf(PCKG_START);
            const endIndex = state.pending.indexOf(PCKG_END);
            found = startIndex >= 0 && endIndex >= 0;
            if (found) {
                const message = state.pending.subarray(startIndex, endIndex + 1);

                if (message[1] === 'D'.charCodeAt(0)) {
                    const messageLength = parseInt(message.subarray(2, 5).toString('ascii'), 10) - 3;
                    if (message.length === messageLength + 8) {
                        const expectedCrc = PackageCommunication.crc16(message.subarray(0, message.length - 3));
                        const actualCrc = message.readUint16BE(message.length - 3);
                        if (actualCrc === expectedCrc) {
                            const payload = message.subarray(5, messageLength + 5);
                            state.items.push(payload.toString('ascii'));
                        }
                    }
                }

                state.pending = state.pending.subarray(endIndex + 1);
            }
        } while (found);

        return state;
    }

    query(cmd: string, timeoutMsec = 1000) {
        return race(this.doWork$, new Observable<string>(observer => {
            const tx = this.sendPacket(cmd).pipe(ignoreElements());
            const rx = this.packages$.pipe(
                timeout(timeoutMsec),
                first(),
            );

            const work: Work = {
                observable: connectable(merge(rx, tx)),
                ignore: false,
            }
            this.work$.next(work);

            return work.observable.subscribe(observer).add(() => {
                work.ignore = true;
            });
        }));
    }

    private static crc16(data: Buffer) {
        const poly = 0x1021;
        let crc = 0;
        for (let j = 0; j < data.length; j++) {
            const byte = data[j];
            crc = crc ^ (byte << 8);
            for (let i = 0; i < 8; i++) {
                crc = crc << 1;
                if (crc & 0x10000)
                    crc = (crc ^ poly) & 0xFFFF;
            }
        }
        return crc;
    }

    private sendPacket(cmd: string) {
        const data = Buffer.from(cmd);
        const length = data.length + 1;

        const req = Buffer.alloc(6 + data.length);
        let offset = 0;
        offset += Buffer.from([PCKG_START]).copy(req, offset);
        offset += Buffer.from('P').copy(req, offset);
        offset += Buffer.from(length.toString(10).padStart(3, '0')).copy(req, offset);
        offset += data.copy(req, offset);
        req.writeUint8(PCKG_END, offset);

        return this.serial.send(req);
    }
}

interface ParseInputState {
    pending: Buffer;
    items: string[];
}

interface Work {
    observable: Connectable<any>;
    ignore: boolean;
}