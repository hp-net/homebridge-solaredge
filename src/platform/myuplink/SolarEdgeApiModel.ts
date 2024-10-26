export interface SiteResponse {
    sites: {
        site: Site[],
    }
}

export interface Site {
    id: string,
    name: string,
    status: string,
}

export interface InventoryResponse {
    Inventory: Inventory
}

export interface Inventory {
    meters: [],
    sensors: [],
    gateways: [],
    inverters: [],
    batteries: Battery[]
}

export interface Battery {
    name: string,
    manufacturer: string,
    model: string,
    SN: string,
}

export interface PowerFlowResponse {
    siteCurrentPowerFlow: PowerFlow
}

export interface PowerFlow {
    refreshRate: number,
    unit: string,
    PV: {
        status: string
        currentPower: number
    },
    LOAD: {
        status: string
        currentPower: number
    },
    STORAGE: {
        status: string
        currentPower: number
        chargeLevel: number
        critical: boolean
    },
    GRID: {
        status: string
        currentPower: number
    },
}
