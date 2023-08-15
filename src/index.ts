import { Observable } from 'rxjs';
import { Mpp } from './communication/mpp';

export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== undefined && value !== null;
}

export interface NodeMessage extends Record<string, any> {
    payload: any;
    topic?: string;
}

export interface NodeInterface {
    credentials: { [key: string]: string };

    on(type: 'input', callback: (msg: NodeMessage, send?: (msgToSend: NodeMessage) => void, done?: (err?: any) => void) => void): void;
    on(type: 'close', callback: () => void): void;

    send(msg: any): void;

    log(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;

    status(params: {
        fill: 'red' | 'green' | 'yellow' | 'blue' | 'grey';
        text: string;
        shape: 'ring' | 'dot';
    } | {}): void;

    context(): {
        get<T>(key: string): T;
        set<T>(key: string, value: T): void;
    };
}

export interface ConfigNode {
    mpp$: Observable<Mpp>;
}
