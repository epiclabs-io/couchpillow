
import {View} from "./View.ts";

export class DesignDocument {
    public views: { [viewName: string]: View }
    public dirty_: boolean = false;
    public name: string;

    constructor(name: string) {
        this.views = {};
        this.name = name;
    }

    public pushView(view: View) {
        this.views[view.name] = view;
        this.dirty_ = true;
    }

    public removeView(name: string) {
        delete this.views[name];
        this.dirty_ = true;

    }


    get dirty(): boolean {
        let d = this.dirty_;
        for (let viewName in this.views) {
            if (d)
                break;
            d = d || this.views[viewName].dirty;
        }

        return d;
    }

    public toJSON() {
        let views = {};
        for (let viewName in this.views) {
            views[viewName] = this.views[viewName].toJSON();
        }

        return { views: views }

    }

    public clean() {
        for (let viewName in this.views) {
            this.views[viewName].clean();
        }
        this.dirty_=false;
    }




}
