import { map } from 'rxjs/operators';
import { Logger } from '../log';
import { SerialCommunication } from './serial';
import { PackageCommunication } from './package';

const DEFAULT_TIMEOUT = 1500;

export class Mpp {
    static create(path: string, logger?: Logger | null) {
        const mpp$ = SerialCommunication
            .create(path, logger?.scope('serial'))
            .pipe(
                map(s => new PackageCommunication(s)),
                map(m => new Mpp(m)),
            );

        return mpp$;
    }

    private constructor(
        private readonly comm: PackageCommunication,
        private timeout = DEFAULT_TIMEOUT) {
    }

    queryProtocolId(timeout?: number) {
        return this.comm.query('PI', timeout ?? this.timeout);
    }

    querySeriesNumber(timeout?: number) {
        return this.comm.query('ID', timeout ?? this.timeout).pipe(
            map(v => {
                const idLength = parseInt(v.substring(0, 2), 10);
                const series = v.substring(2, 2 + idLength);
                return series;
            }),
        );
    }

    queryCpuVersion(timeout?: number) {
        return this.comm.query('VFW', timeout ?? this.timeout).pipe(
            map(v => {
                return v.startsWith('VERFW:') ? v.split(':')[1] : v;
            }),
        );
    }

    query2ndCpuVersion(timeout?: number) {
        return this.comm.query('VFW2', timeout ?? this.timeout).pipe(
            map(v => {
                return v.startsWith('VERFW2:') ? v.split(':')[1] : v;
            }),
        );
    }

    queryDeviceModel(timeout?: number) {
        return this.comm.query('MD', timeout ?? this.timeout).pipe(
            map(v => {
                const parts = v.split(',').map(p => +p);
                return {
                    machineNumber: parts[0],
                    ratedVa: parts[1],
                    outputPowerFactor: parts[2] / 100,
                    inputPhaseNumber: parts[3],
                    outputPhaseNumber: parts[4],
                    nominalOutputVoltage: parts[5] / 10,
                    nominalInputVoltage: parts[6] / 10,
                    batteryPieceNumber: parts[7],
                    batteryVoltagePerUnit: parts[8] / 10,
                };
            }),
        );
    }

    queryRatedInformation(timeout?: number) {
        return this.comm.query('PIRI', timeout ?? this.timeout).pipe(
            map(v => {
                const parts = v.split(',').map(p => +p);
                return {
                    ratedInput: {
                        voltage: parts[0] / 10,
                        freq: parts[1] / 10,
                        current: parts[2] / 10,
                    },
                    ratedOutput: {
                        voltage: parts[3] / 10,
                        current: parts[4] / 10,
                    },
                    mpptRatedCurrentPerString: parts[5] / 10,
                    batteryRatedVoltage: parts[6] / 10,
                    mpptTrackNumber: parts[7],
                    machineType: parts[8],
                    topology: parts[9],
                    parralelForOutputEnabled: parts[10] === 1,
                };
            }),
        );
    }

    queryGeneralStatus(timeout?: number) {
        return this.comm.query('GS', timeout ?? this.timeout).pipe(
            map(v => {
                const parts = v.split(',').map(p => +p);
                return {
                    solarInput: {
                        voltage1: parts[0] / 10,
                        voltage2: parts[1] / 10,
                        current1: parts[2] / 100,
                        current2: parts[3] / 100,
                    },
                    battery: {
                        voltage: parts[4] / 10,
                        capacity: parts[5],
                        current: parts[6] / 10,
                    },
                    acInput: {
                        voltage: {
                            R: parts[7] / 10,
                            S: parts[8] / 10,
                            T: parts[9] / 10,
                        },
                        frequency: parts[10] / 100,
                    },
                    acOutput: {
                        voltage: {
                            R: parts[14] / 10,
                            S: parts[15] / 10,
                            T: parts[16] / 10,
                        },
                        frequency: parts[17] / 100,
                    },
                };
            }),
        );
    }

    queryPowerStatus(timeout?: number) {
        return this.comm.query('PS', timeout ?? this.timeout).pipe(
            map(v => {
                const parts = v.split(',').map(p => +p);
                return {
                    solarInput: {
                        power1: parts[0],
                        power2: parts[1],
                    },
                    acInput: {
                        activePower: {
                            R: parts[3],
                            S: parts[4],
                            T: parts[5],
                            total: parts[6],
                        },

                    },
                    acOutput: {
                        activePower: {
                            R: parts[7],
                            S: parts[8],
                            T: parts[9],
                            total: parts[10],
                        },
                        apparentPower: {
                            R: parts[11],
                            S: parts[12],
                            T: parts[13],
                            total: parts[14],
                        },
                        percentage: parts[15],
                    },
                    status: {
                        acOutputConnected: parts[16] === 1,
                        solarInput1Working: parts[17] === 1,
                        solarInput2Working: parts[18] === 1,
                        batteryPowerDirection: parts[19],
                        batteryPowerDirectionStatus: BatteryPowerDirectionMapping.get(parts[19]),
                        dcAcPowerDirection: parts[20],
                        dcAcPowerDirectionStatus: DcAcPowerDirectionMapping.get(parts[20]),
                        linePowerDirection: parts[21],
                        linePowerDirectionStatus: LinePowerDirectionMapping.get(parts[21]),
                    },
                };
            }),
        );
    }

    queryWorkingMode(timeout?: number) {
        return this.comm.query('MOD', timeout ?? this.timeout).pipe(
            map(v => {
                const mode = +v;
                return {
                    mode,
                    description: WorkingModeMapping.get(mode),
                };
            }),
        );
    }

    queryWarningStatus(timeout?: number) {
        return this.comm.query('WS', timeout ?? this.timeout).pipe(
            map(v => {
                const warnings =
                    v.split(',')
                        .map((v, index) => {
                            return +v ? WarningMapping[index] : null;
                        })
                        .filter(isDefined);
                return warnings;
            }),
        );
    }

    queryFlags(timeout?: number) {
        return this.comm.query('FLAG', timeout ?? this.timeout).pipe(
            map(v => {
                const parts = v.split(',').map(p => +p);
                return {
                    muteBuzzer: !!parts[0],
                    muteBuzzerInStandbyMode: !!parts[1],
                    muteBuzzerOnBattery: !!parts[2],
                    generatorAsAcInput: !!parts[3],
                    wideAcInputRange: !!parts[4],
                    ngRelayFunction: !!parts[5],
                    deratingPowerForGridVoltage: !!parts[6],
                    deratingPowerForGridFrequency: !!parts[7],
                    bmsBatteryConnect: !!parts[8],
                    lowFrequencyDeratingPower: !!parts[9],
                    lowVoltageRideThrough: !!parts[10],
                    highVoltageRideThrough: !!parts[11],
                    chargePowerLimit: !!parts[12],
                    externalCtRlyConnect: !!parts[13],
                    pvParallel: !!parts[14],
                    acOutputCoupling: !!parts[15],

                }
            }),
        );
    }
}

function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== void 0;
}

const BatteryPowerDirectionMapping = new Map<number, string>([
    [0, 'donothing'],
    [1, 'charge'],
    [2, 'discharge'],
]);

const DcAcPowerDirectionMapping = new Map<number, string>([
    [0, 'donothing'],
    [1, 'AC-DC'],
    [2, 'DC-AC'],
]);


const LinePowerDirectionMapping = new Map<number, string>([
    [0, 'donothing'],
    [1, 'input'],
    [2, 'output'],
]);

const WorkingModeMapping = new Map<number, string>([
    [0, 'power-on'],
    [1, 'standby'],
    [2, 'bypass'],
    [3, 'battery'],
    [4, 'fault'],
    [5, 'hybrid'],
    [6, 'charge'],
]);

const WarningMapping = [
    {
        name: 'solar-input-1-loss',
        description: 'Solar input 1 voltage exceed the acceptable range',
    },
    {
        name: 'solar-input-2-loss',
        description: 'Solar input 2 voltage exceed the acceptable range',
    },
    {
        name: 'solar-input-1-voltage-high',
        description: 'Solar input 1 voltage exceed the highest level',
    },
    {
        name: 'solar-input-2-voltage-high',
        description: 'Solar input 2 voltage exceed the highest level',
    },
    {
        name: 'battery-under',
        description: 'Battery voltage drop to unacceptable level',
    },
    {
        name: 'vattery-low',
        description: 'Battery voltage near to unacceptable level',
    },
    {
        name: 'battery-open',
        description: 'Battery disconnected',
    },
    {
        name: 'battery-high',
        description: 'Battery voltage exceed the highest level',
    },
    {
        name: 'battery-low-hybrid-mode',
        description: 'Battery voltage drop to unacceptable level of hybrid mode',
    },
    {
        name: 'grid-voltage-high',
        description: 'AC input voltage higher than the highest level of AC feeding voltage',
    },
    {
        name: 'grid-voltage-low',
        description: 'AC input voltage lower than the lowest level of AC feeding voltage'
    },
    {
        name: 'grid-frequency-high',
        description: 'AC input frequency higher than the highest level of AC feeding frequency',
    },
    {
        name: 'grid-frequency-low',
        description: 'AC input voltage lower than the lowest level of AC feeding frequency',
    },
    {
        name: 'ac-input-long-time-average-voltage-over',
        description: 'AC input long - time average voltage exceed the highest level',
    },
    {
        name: 'ac-input-voltage-loss',
        description: 'AC input voltage out of acceptable range',
    },
    {
        name: 'ac-input-frequency-loss',
        description: 'AC input frequency out of acceptable range',
    },
    {
        name: 'ac-input-island',
        description: 'AC input has been detected for the island',
    },
    {
        name: 'ac-input-phase-dislocation',
        description: 'AC input three phase dislocation',
    },
    {
        name: 'over-temperature',
        description: 'Machine temperature near to unacceptable level',
    },
    {
        name: 'over-load',
        description: 'The loads connect to machine exceed abnormal level',
    },
    {
        name: 'epo-active',
        description: 'Emergent power off active',
    },
    {
        name: 'ac-input-wave-loss',
        description: 'AC input wave terrible',
    },
    {
        name: 'equalization-states',
        description: 'Equalization states （WP LV 6KW is reserved）',
    }
]