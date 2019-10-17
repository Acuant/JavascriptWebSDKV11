var config = {}

if(typeof acuantConfig !== "undefined" && Object.keys(acuantConfig).length !== 0 && acuantConfig.constructor === Object){
    config = acuantConfig
}

var Module = {
    onRuntimeInitialized: function() {
        loadAcuantSdk();

        if(typeof onAcuantSdkLoaded === "function"){
            onAcuantSdkLoaded();
        }
    }
};

var AcuantJavascriptWebSdk = undefined;

const script = document.createElement("script");
script.src = (config.path || "") + "AcuantImageProcessingService.js";
script.async = true;
document.body.appendChild(script);

function loadAcuantSdk(){
    AcuantJavascriptWebSdk = (function(config){
        var svc = {
            start: function(){
                if(!isWorkerStarted){
                    isWorkerStarted = true;
                    Module.ccall("start", null, ["string"], [(config.path || null)]);
                    addInternalCallback();
                }
            },
            
            end: function(){
                if(isWorkerStarted){
                    Module.ccall("end");
                    removeInternalCallback();
                    isWorkerStarted = false;
                }
            },
        
            initialize: function(token, endpt, cb){
                this.start();
                addClientCallback(STORED_INIT_FUNC_KEY, cb);
        
                Module.ccall("initialize", null, ["string", "string", "number"], [token, endpt, storedCallbacks[STORED_INIT_FUNC_KEY]])
            },
            
            crop: function(imgData, width, height, cb, includeSharpness = true, includeGlare = true){
                if(isWorkerStarted){
                    allocatedBytes = arrayToHeap(imgData.data);
                    addClientCallback(STORED_CROP_FUNC_KEY, cb);
        
                    Module.ccall("crop", null, ["number", "number", "number", "number", "number", "number", "number"], [allocatedBytes.byteOffset, imgData.data.length, width, height, storedCallbacks[STORED_CROP_FUNC_KEY], includeSharpness, includeGlare])
                } 
                else{
                    cb.onFail();
                }
            } 
        };
    
        const STORED_INIT_FUNC_KEY = "init";
        const STORED_CROP_FUNC_KEY = "crop";
    
        const DPI_PASSPORT_SCALE_VALUE = 4.92;
        const DPI_ID_SCALE_VALUE = 3.37;
    
        var isWorkerStarted = false;
        var clientCallbacks = {};
        var storedCallbacks = {};
        var allocatedBytes = null;
    
        function addInternalCallback(){
            addCallback(STORED_INIT_FUNC_KEY, onInitialize, "vi");
            addCallback(STORED_CROP_FUNC_KEY, onCrop, "viiiff");
        }
    
        function removeInternalCallback(){
            removeCallback(STORED_INIT_FUNC_KEY);
            removeCallback(STORED_CROP_FUNC_KEY);
        }
    
        function onInitialize(isSuccess){
            var cb = clientCallbacks[STORED_INIT_FUNC_KEY];
            if(cb){
                if(isSuccess == 1){
                    cb.onSuccess();
                }
                else{
                    cb.onFail();
                }
            }
        }
    
        function onCrop(width, height, isPassport, rawGlare, rawSharpness){
            var cb = clientCallbacks[STORED_CROP_FUNC_KEY];
    
            if(cb){
                if(width != -1 && height != -1 && isPassport != -1){
                    let base64Img = getImageData(width, height),
                        dpi = calculateDpi(width, height, isPassport),
                        sharpness = rawSharpness > 0 ? scaleImageMetricScore(rawSharpness, 0.17) : rawSharpness,
                        glare = rawGlare > 0 ? scaleImageMetricScore(rawGlare, 0.17) : rawGlare;
        
                    cb.onSuccess({ 
                        image: { 
                            data: base64Img,
                            width,
                            height
                        }, 
                        glare, 
                        sharpness,
                        isPassport,
                        dpi
                    });
                }
                else{
                    cb.onFail();
                }
            }
    
            Module.ccall("release");
            freeArray(allocatedBytes);
        }
    
        function scaleImageMetricScore(rawScore, scaleValue){
            let buckets = {
                0.0 : 0.0,
                1.0 : 100.0
            }
            buckets[scaleValue] = 50.0;
    
            if(buckets[rawScore]){
                return Math.round(buckets[rawScore]);
            }
    
            var higherRaw = 1.0,
                lowerRaw = 0.0;
            
            if(rawScore > scaleValue){
                lowerRaw = scaleValue;
            }
            else{
                higherRaw = scaleValue
            }
    
            let distance = (rawScore - lowerRaw) / (higherRaw - lowerRaw);
    
            return Math.round((buckets[lowerRaw] * (1-distance)) + (buckets[higherRaw] * distance));
        }
    
        function calculateDpi(width, height, isPassport){
            let longerSide = width > height ? width : height;
            let scaleValue = isPassport ? DPI_PASSPORT_SCALE_VALUE : DPI_ID_SCALE_VALUE;
    
            return Math.round(longerSide/scaleValue);
        }
    
        function getImageData(width, height){
            var rgbData = Module.getBytes();
            var mCanvas = document.createElement('canvas');
            mCanvas.width = width;
            mCanvas.height = height;
        
            var mContext = mCanvas.getContext('2d');
            var mImgData = mContext.createImageData(width, height);
        
            var srcIndex=0, dstIndex=0, curPixelNum=0;
                                
            for (curPixelNum=0; curPixelNum<width*height;  curPixelNum++)
            {
                mImgData.data[dstIndex] = rgbData[srcIndex];        // r
                mImgData.data[dstIndex+1] = rgbData[srcIndex+1];    // g
                mImgData.data[dstIndex+2] = rgbData[srcIndex+2];    // b
                mImgData.data[dstIndex+3] = 255; // 255 = 0xFF - constant alpha, 100% opaque
                srcIndex += 3;
                dstIndex += 4;
            }
            this.image = mImgData;
            mContext.putImageData(mImgData, 0, 0);
            return mCanvas.toDataURL("image/jpeg");
        }
    
        function addClientCallback(key, fn){
            clientCallbacks[key] = fn;
        }
    
        function addCallback(key, fn, fnParams){
            let exisiting = storedCallbacks[key];
            if(!exisiting){
                storedCallbacks[key] = Module.addFunction(fn, fnParams);
            }
        }
    
        function removeCallback(key){
            let fn = storedCallbacks[key];
            if(fn){
                Module.removeFunction(fn);
                storedCallbacks[key] = null;
            }
        }
    
        function freeArray(input){
            Module._free(input.byteOffset);
        }
    
        function arrayToHeap(typedArray){
            var numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
            var ptr = Module._malloc(numBytes);
            var heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
            heapBytes.set(new Uint8Array(typedArray.buffer));
            return heapBytes;
        }
    
        return svc;
    })(config);
}
 