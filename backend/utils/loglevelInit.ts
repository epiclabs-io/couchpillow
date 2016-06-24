/// <reference path="../../typings/tsd.d.ts" />

import * as loglevel from "loglevel";

var originalFactory = loglevel.methodFactory;
loglevel.methodFactory = function (methodName, logLevel, loggerName) {
    var rawMethod = originalFactory(methodName, logLevel, loggerName);
        
    return function (... args:any[]) {
        if(typeof args[0] === "string")
            args[0]=methodName +" [" + loggerName + "]: " + args[0];
            
        rawMethod.apply(null,args);
    };
};


loglevel.setLevel("info");
