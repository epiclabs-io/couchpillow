
export class View {
    private _map: string;
    private _reduce: string;
    public name: string;
    public dirty: boolean;

    constructor(name: string, map?: Function | string, reduce?: Function | string) {
        this.name = name;
        this.map = map;
        this.reduce = reduce;
        this.dirty = true;
    }


    get map(): Function | string {
        return this._map;
    }

    set map(func: Function | string) {
        this._map = func ? func.toString() : null;
        this.dirty = true;
    }

    get reduce(): Function | string {
        return this._reduce;
    }

    set reduce(func: Function | string) {
        this._reduce = func ? func.toString() : null;
        this.dirty = true;
    }

    public toJSON() {
        var obj = {};
        if (this._map)
            obj["map"] = this._map;
        if (this._reduce)
            obj["reduce"] = this._reduce;
        return obj;
    }
    public clean() {
        this.dirty = false;
    }

}
