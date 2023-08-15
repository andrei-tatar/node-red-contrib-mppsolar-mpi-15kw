import { Observable, Subject } from 'rxjs';
import { SerialPort } from 'serialport';
import { Logger } from '../log';

export class SerialCommunication {

    private _data = new Subject<Buffer>();

    readonly data$ = this._data.asObservable();

    private constructor(
        private readonly port: SerialPort,
        private readonly logger?: Logger,
    ) {
        port.on('data', msg => this._data.next(msg));
    }

    static create(path: string, logger?: Logger) {
        return new Observable<SerialCommunication>(observer => {
            const port = new SerialPort({
                path: path,
                baudRate: 2400,
            });

            const wrapper = new SerialCommunication(port, logger);
            port.on('open', () => {
                logger?.trace('connected');
                observer.next(wrapper)
            });
            port.on('error', (err) => {
                logger?.trace('error', { err });
                observer.error(err);
            });
            port.on('close', () => {
                logger?.trace('connection closed');
                observer.error(new Error('Port was closed'));
            });

            return () => {
                logger?.trace('observable closed');
                wrapper.end();
                port.end();
            };
        })
    }

    send(data: Buffer): Observable<void> {
        return new Observable(observer => {
            this.port.write(data, err => {
                if (err) {
                    observer.error(err);
                } else {
                    observer.complete();
                }
            });
        });
    }

    end() {
        this.logger?.trace('end');
        this._data.complete();
        this.port.end();
    }
}