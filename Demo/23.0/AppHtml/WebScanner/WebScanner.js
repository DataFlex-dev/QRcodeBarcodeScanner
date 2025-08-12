var CODE_FORMAT_128     = 1;
var CODE_FORMAT_EAN     = 2;
var CODE_FORMAT_EAN_8   = 3;
var CODE_FORMAT_39      = 4;
var CODE_FORMAT_39_VIN  = 5;
var CODE_FORMAT_CODABAR = 6;
var CODE_FORMAT_UPC     = 7;
var CODE_FORMAT_UPC_E   = 8;
var CODE_FORMAT_I2OF5   = 9;
var CODE_FORMAT_2OF5    = 10;
var CODE_FORMAT_93      = 11;
var CODE_FORMAT_QR      = 12;

var PATCH_SIZE_XS = 1;
var PATCH_SIZE_S  = 2;
var PATCH_SIZE_M  = 3;
var PATCH_SIZE_L  = 4;
var PATCH_SIZE_XL = 5;

tCodeResultInfo = {
    iError : df.tInt,
    iCode : df.tInt,
    iStart : df.tInt,
    iEnd : df.tInt    
};

tCodeResult = {
    sCode : df.tString,
    sCodeFormat : df.tString,
    iStart : df.tInt,
    iEnd : df.tInt,
    iCodeSet : df.tInt,
    StartInfo : tCodeResultInfo,
    EndInfo : tCodeResultInfo,
    iDirection : df.tInt
};

df.WebScanner = function WebScanner(sName, oPrnt){
    df.WebScanner.base.constructor.apply(this, arguments);

    this.prop(df.tInt, "peCodeFormat", CODE_FORMAT_128);
    this.prop(df.tString, "psCodeFormatMulti", "");
    this.prop(df.tBool, "pbEnableExtendedEAN", false);
    this.prop(df.tInt, "pePatchSize", PATCH_SIZE_M);
    this.prop(df.tInt, "piFrequency", 10);
    this.prop(df.tBool, "pbHalfSample", true);
    this.prop(df.tBool, "pbAutoLocate", true);
    this.prop(df.tBool, "pbDrawDetectionBoxes", true);
    this.prop(df.tBool, "pbStopAfterDetection", true);
    this.prop(df.tInt, "piScannerWidth", 640);
    this.prop(df.tInt, "piScannerHeight", 480);

    // Qr Scanner specifics
    this._oQrScanner = null;
    this._eQrScannerElem = null;
    this._eQrCanvasElem = null;
    this._aCameras = [];

    this._bIsRunning = false;
    this._eRunningFormat = -1;
    this._sDeviceId = "";
    // Used to mark processing state, prevents multiple calls to the server in a single scan
    this._qrFrontalCamera = paulmillrQr.dom.frontalCamera;
    this._qrQrCanvas = paulmillrQr.dom.QRCanvas;
    this._qrFrameLoop = paulmillrQr.dom.frameLoop;
    this._eQrCanvas;
    
    this._bProcessing = false;
    this._cancelMainLoop;

};

df.defineClass("df.WebScanner", "df.WebBaseControl", {

openHtml : function(aHtml) {
    df.WebScanner.base.openHtml.call(this, aHtml);
    aHtml.push('<div Class="WebScanner_Container" style="width: 100%; height: 100%;">');
    aHtml.push('    <div Class="WebScanner_ViewPort" style="width: 100%; height: 100%;"></div>');
    aHtml.push('</div>');
},

afterRender : function() {
    df.WebScanner.base.afterRender.call(this);
},

startScanner : function() {
    this.stopScanner();
    this.initScanner();
    this._bIsRunning = true;
},

stopScanner : function() {
    if (this._bIsRunning) {
        if (this._eRunningFormat == CODE_FORMAT_QR) {
            this._oQrScanner.stop();
            this.destroyQrScanner();
        } else {
            this.destroyQuaggaScanner();
        }
        this._bIsRunning = false;
        this._eRunningFormat = -1;
    }
},

// Restarts the scanner if it was already running
restartScanner : function() {
    this.stopScanner();
    this.initScanner();
},

initScanner : function() {
    if (this.peCodeFormat == CODE_FORMAT_QR) {
        this.initQrScanner();
    } else {
        this.initQuaggaScanner();
    }
    this._eRunningFormat = this.peCodeFormat;
},

mainLoop : function() {
    this._qrFrameLoop(() => {
        const res = this._oQrScanner.readFrame(this._eQrCanvas, true)
        if (res !== undefined) {
            this.processQrCode(res);
        }
    })
},

initQrScanner : async function() {
    var eViewPortElem;

    this._eQrScannerElem = df.dom.create('<video id="WebScanner_QR_Scanner" style="width: 100%; height: 100%;"></video>');
    eViewPortElem = df.dom.query(this._eElem, ".WebScanner_ViewPort");
    eViewPortElem.appendChild(this._eQrScannerElem);    
    this._eQrCanvasElem = df.dom.create('<canvas id="WebScanner_QR_Scanner_canvas" style="width: 100%; height: 100%;"></canvas>');
    eViewPortElem.appendChild(this._eQrCanvasElem);   
    
    var player = document.getElementById('WebScanner_QR_Scanner');
    var canvas = document.getElementById('WebScanner_QR_Scanner_canvas');
    this._eQrBitmap = document.getElementById('WebScanner_QR_Scanner_bitmap');
    // this._oQrScanner = new Instascan.Scanner({ video: player, mirror: false });
    this._oQrScanner = await this._qrFrontalCamera(player);
    this.createCameraCombo(this, await this._oQrScanner.listDevices());
    if (this._eQrCanvas) this._eQrCanvas.clear();
    this._eQrCanvas = new this._qrQrCanvas({ overlay: this.pbDrawDetectionBoxes ? this._eQrCanvasElem : undefined }, { cropToSquare: false });

    this._eQrScannerElem.addEventListener('play', () => {
        if (this._cancelMainLoop) this.cancelMainLoop(); // stop
        this._cancelMainLoop = this.mainLoop();
    });
},


destroyQrScanner : function() {
    var eContainerElem, eCameraComboElem;

    if (this._oQrScanner) {
        this._oQrScanner.stop();
    }
    if (this._eQrScannerElem) {
        this._eQrScannerElem.parentNode.removeChild(this._eQrScannerElem);
        this._eQrScannerElem = null;
    }
    if (this._eQrCanvasElem) {
        this._eQrCanvasElem.parentNode.removeChild(this._eQrCanvasElem);
        this._eQrCanvasElem = null;
    }
    eContainerElem = df.dom.query(this._eElem, ".WebScanner_Container");
    if (eContainerElem) {
        eCameraComboElem = df.dom.query(eContainerElem, ".WebScanner_cameras");
        if (eCameraComboElem) {
            eContainerElem.removeChild(eCameraComboElem);
        }
    }
},

initQuaggaScanner : function() {
    var that = this;
    var aReaders, sPatchSize, iWorkers, iFrequency;

    if (this.psCodeFormatMulti == "") {
        aReaders = [this.getCodeReader(this.peCodeFormat)];
    } else {
        aReaders = this.getCodeReaderMulti(this.psCodeFormatMulti);
    }
    if (this.pbEnableExtendedEAN) { 
        aReaders = this.getExtendedEANReaders(aReaders); 
    }

    sPatchSize = this.getPatchSize(this.pePatchSize);
    iWorkers = this.getWorkers();
    iFrequency = this.getFrequency();

    Quagga.CameraAccess.enumerateVideoDevices().then(function(cameras) {
        that.createCameraCombo(that, cameras);

        // Init after we get all cameras
        Quagga.init({
            inputStream : {
              name : "Live",
              type : "LiveStream",
              target: document.querySelector('.WebScanner_ViewPort'),
              constraints: {
                    width: that.piScannerWidth,
                    height: that.piScannerHeight,
                    facingMode: "environment",
                    deviceId: that._sDeviceId
                }
            },
            decoder : {
              readers : aReaders
            },
            locator: {
                patchSize: sPatchSize,
                halfSample: that.pbHalfSample
            },
            numOfWorkers: iWorkers,
            frequency: iFrequency,
            locate: that.pbAutoLocate,
            multiple: false
        }, function(err) {
              if (err) {
                  console.log(err);
                  return
              }
             Quagga.start();
        });

        if (this.pbDrawDetectionBoxes) {
            Quagga.onProcessed(function(result) {
                that.highlightBarcode(result);
            });
        } else {
            Quagga.offProcessed(that);
        }

        Quagga.onDetected(function(result) {
            that.processBarCode(result);
        });
    });
},

destroyQuaggaScanner : function() {
    var eViewPortElem, eContainerElem, eCameraComboElem;

    Quagga.stop();
    this._sDeviceId = '';

    eViewPortElem = df.dom.query(this._eElem, ".WebScanner_ViewPort");
    if (eViewPortElem) {
        eViewPortElem.innerHTML = '';
    }

    eContainerElem = df.dom.query(this._eElem, ".WebScanner_Container");
    if (eContainerElem) {
        eCameraComboElem = df.dom.query(eContainerElem, ".WebScanner_cameras");
        if (eCameraComboElem) {
            eContainerElem.removeChild(eCameraComboElem);
        }
    }
},

changeCamera : function(oEv) {
    var sId;

    if (this._oQrScanner) {
        for (var i = 0 ; i < this._aCameras.length ; i++) {
            if (this._aCameras[i].deviceId == oEv.e.srcElement.value) {
                this._oQrScanner.setDevice(this._aCameras[i].deviceId);
            }
        }
        this._oQrScanner.stop();
    } else {
        if (this._bIsRunning) {
            for (var i = 0 ; i < this._aCameras.length ; i++) {
                sId = (this._aCameras[i].id || this._aCameras[i].deviceId);

                if (sId== oEv.e.srcElement.value) {
                    this.destroyQuaggaScanner();
                    this._sDeviceId = sId;
                    this.initQuaggaScanner();
                }
            }
        }
    }
},

createCameraCombo : function(that, cameras) {
    var sCameraComboHtml, eCameraComboElem, eContainerElem;

    that._aCameras = cameras;

    // Create camera combo
    sCameraComboHtml = '<select class="WebScanner_cameras">';
    for (var i = 0 ; i < cameras.length ; i ++) {
        sCameraComboHtml += '<option value="' + (cameras[i].id || cameras[i].deviceId) + '">' + (cameras[i].name || cameras[i].label) + '</option>'
    }
    sCameraComboHtml += '</select>';
    eCameraComboElem = df.dom.create(sCameraComboHtml);
    eContainerElem = df.dom.query(that._eElem, ".WebScanner_Container");
    eContainerElem.insertBefore(eCameraComboElem, eContainerElem.firstChild);

    // The last camera in the list is usually the back (environment) facing one. It makes sense to preselect this if possible
    if (that._sDeviceId == "") {
        that._sDeviceId = (cameras[(cameras.length -1)].id || cameras[(cameras.length -1)].deviceId);
    }
    eCameraComboElem.value = that._sDeviceId;

    // Attach onchange handler
    df.events.addDomListener("change", eCameraComboElem, that.changeCamera, that);
},

highlightBarcode : function(result) {
    var drawingCtx = Quagga.canvas.ctx.overlay,
        drawingCanvas = Quagga.canvas.dom.overlay;

    if (result) {
        if (result.boxes) {
            drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
            result.boxes.filter(function (box) {
                return box !== result.box;
            }).forEach(function (box) {
                Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
            });
        }

        if (result.box) {
            Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
        }

        if (result.codeResult && result.codeResult.code) {
            Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
        }
    }
},

serializeCodeResult : df.sys.vt.generateSerializer(tCodeResult),

processQrCode : function(result) {
    var oSvrCodeResult, tVT;
    var that = this;

    if (!this._bProcessing) {
        this._bProcessing = true;
        
        oSvrCodeResult = this.toSvrQrCodeResult(result);
        tVT = this.serializeCodeResult(oSvrCodeResult);
            
        this.serverAction("ProcessCodeResult", [], tVT, function() {
            that._bProcessing = false;
        });

        if (this.pbStopAfterDetection) {
            this.destroyQrScanner();
        }
    }
},

processBarCode : function(oData) {
    var oSvrCodeResult, tVT;
    var that = this;

    if (!this._bProcessing) {
        this._bProcessing = true;
        if (this.pbStopAfterDetection) {
            this.destroyQuaggaScanner();
        }

        oSvrCodeResult = this.toSvrCodeResult(oData.codeResult);
        tVT = this.serializeCodeResult(oSvrCodeResult);
            
        this.serverAction("ProcessCodeResult", [], tVT, function() {
            that._bProcessing = false;
        });
    }
},

getCodeReader : function(eCodeFormat) {
    switch (eCodeFormat) {
        case CODE_FORMAT_128:
            return "code_128_reader";
        break;
        case CODE_FORMAT_EAN:
            return "ean_reader";
        break;
        case CODE_FORMAT_EAN_8:
            return "ean_8_reader";
        break;
        case CODE_FORMAT_39:
            return "code_39_reader";
        break;
        case CODE_FORMAT_39_VIN:
            return "code_39_vin_reader";
        break;
        case CODE_FORMAT_CODABAR:
            return "codabar_reader";
        break;
        case CODE_FORMAT_UPC:
            return "upc_reader";
        break;
        case CODE_FORMAT_UPC_E:
            return "upc_e_reader";
        break;
        case CODE_FORMAT_I2OF5:
            return "i2of5_reader";
        break;
        case CODE_FORMAT_2OF5:
            return "2of5_reader";
        break;
        case CODE_FORMAT_93:
            return "code_93_reader";
        break;
        default:
            return "code_128_reader";
    }
},

getCodeReaderMulti : function(sCodeReaderMulti) {
    var aReaders = [];

    aReaders = sCodeReaderMulti.split(",").map(function(sReader) {
                                                  return sReader.trim();
                                                });
    return aReaders;
},

getExtendedEANReaders : function(aReaders) {
    var i;
    var oReader;
    var aReaderObjs = [];

    for (i = 0 ; i < aReaders.length ; i++) {
        if (aReaders[i] == "ean_reader") {
            // Extended EAN (-5 -2)
            oReader = {
                format: aReaders[i],
                config: {
                    supplements: ['ean_5_reader', 'ean_2_reader']
                }
            };

            aReaderObjs.push(oReader);

            // Regular EAN (EAN-13)
            oReader = {
                format: aReaders[i],
                config: {
                    supplements: []
                }
            };

            aReaderObjs.push(oReader);
        } else {
            oReader = {
                format: aReaders[i],
                config: {
                    supplements: []
                }
            };

            aReaderObjs.push(oReader);
        }
    }

    return aReaderObjs;
},

getPatchSize : function(ePatchSize) {
    switch (ePatchSize) {
        case PATCH_SIZE_XS:
            return "x-small";
        break;
        case PATCH_SIZE_S:
            return "small";
        break;
        case PATCH_SIZE_M:
            return "medium";
        break;
        case PATCH_SIZE_L:
            return "large";
        break;
        case PATCH_SIZE_XL:
            return "x-large";
        break;
        default:
            return "medium";
    }
},

set_peCodeFormat : function(val) {
    var bWasRunning
    
    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    
    this.peCodeFormat = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_psCodeFormatMulti : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;

    this.stopScanner();
    this.psCodeFormatMulti = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_pePatchSize : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    this.pePatchSize = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_piWorkers : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    this.piWorkers = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_piFrequency : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    this.piFrequency = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_pbHalfSample : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    this.pbHalfSample = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_pbAutoLocate : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    this.pbAutoLocate = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_pbDrawDetectionBoxes : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    this.pbDrawDetectionBoxes = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_piScannerWidth : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    this.piScannerWidth = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

set_piScannerHeight : function(val) {
    var bWasRunning;

    bWasRunning = this._bIsRunning;
    
    this.stopScanner();
    this.piScannerHeight = val;
    
    if (bWasRunning) {
        this.startScanner();
    }
},

getWorkers : function() {
    var iRet = 1;

    iRet = navigator.hardwareConcurrency;

    return iRet;
},

getFrequency : function() {
    var val;

    val = this.piFrequency;

    if (val < 1) { val = 1; }
    if (val > 20) { val = 20; }

    return val;
},

toSvrCodeResult : function(oCodeResult){
    var oSvrCodeResult, oStartInfo, oEndInfo;

    if (oCodeResult.startInfo) {
        oStartInfo = {
            iError : oCodeResult.startInfo.error || -1,
            iCode : oCodeResult.startInfo.code || -1,
            iStart : oCodeResult.startInfo.start || -1,
            iEnd : oCodeResult.startInfo.end || -1 
        };
    } else {
        oStartInfo = {
            iError : -1,
            iCode : -1,
            iStart : -1,
            iEnd : -1 
        };
    }

    if (oCodeResult.endInfo) {
        oEndInfo = {
            iError : oCodeResult.endInfo.error || -1,
            iCode : oCodeResult.endInfo.code || -1,
            iStart : oCodeResult.endInfo.start || -1,
            iEnd : oCodeResult.endInfo.end || -1
        };
    } else {
        oEndInfo = {
            iError : -1,
            iCode : -1,
            iStart : -1,
            iEnd : -1 
        };
    }

    oSvrCodeResult = {
        sCode : oCodeResult.code || "",
        sCodeFormat : oCodeResult.format || "",
        iStart : oCodeResult.start || -1,
        iEnd : oCodeResult.end || -1,
        iCodeSet : oCodeResult.codeset || -1,
        StartInfo : oStartInfo,
        EndInfo : oEndInfo,
        iDirection : oCodeResult.direction || 0
    };

    return oSvrCodeResult;
},

toSvrQrCodeResult : function(sResult){
    var oSvrCodeResult, oStartInfo, oEndInfo;

    oStartInfo = {
        iError : -1,
        iCode : -1,
        iStart : -1,
        iEnd : -1 
    };

    oEndInfo = {
        iError : -1,
        iCode : -1,
        iStart : -1,
        iEnd : -1 
    };

    oSvrCodeResult = {
        sCode : sResult || "",
        sCodeFormat : "QR",
        iStart : -1,
        iEnd : -1,
        iCodeSet : -1,
        StartInfo : oStartInfo,
        EndInfo : oEndInfo,
        iDirection : 0
    };

    return oSvrCodeResult;
}

});