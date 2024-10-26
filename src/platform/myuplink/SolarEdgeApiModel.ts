export interface Site {
    siteId: string;
    name: string;
    peakPower: number;
    activationStatus: string;
}

export interface Device {
    type: string;
    serialNumber: string;
    manufacturer: string;
    model: string;
    createdAt: string;
    connectedTo: string;
    active: boolean;
    nameplate: number;
    communicationType: string;
}

export interface PowerFlow {
    updatedAt: string,
    refreshRate: number,
    unit: string,
    pv: {
        active: boolean
        power: number
    },
    load: {
        active: boolean
        power: number
    },
    storage: {
        active: boolean
        power: number
        status: string
        chargeLevel: number
    },
    grid: {
        active: boolean
        power: number
        status: string
    },
}
