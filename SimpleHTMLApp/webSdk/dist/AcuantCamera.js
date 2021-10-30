var AcuantCameraUI = (function () {
  'use strict';
  let player = null;

  let uiCanvas = null;
  let uiContext = null;
  let acuantCamera = null;

  let svc = {
    start: start,
    end: end,
  };

  let isStarted = false;

  let onDetectedResult = null;
  // let previousState = null;
  let counter = null;
  let uiStateTextElement = null;
  let errorCallback= null;

  let timeout = null;
  let uiTimeout = null;

  const UI_STATE = {
    CAPTURING: -1,
    TAP_TO_CAPTURE: -2
  }

  let userOptions = {
    text: {
      NONE: "ALIGN",
      SMALL_DOCUMENT: "MOVE CLOSER",
      GOOD_DOCUMENT: null,
      CAPTURING: "CAPTURING",
      TAP_TO_CAPTURE: "TAP TO CAPTURE"
    }
  };

  const TRIGGER_TIME = 2000;
  const DETECT_TIME_THRESHOLD = 400;//slightly increased from 300, 
  let minTime = Number.MAX_VALUE;

  function reset() {
    onDetectedResult = null;
    counter = null;
    uiStateTextElement = null;
  }

  function end() {
    reset();
    isStarted = false;
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (uiTimeout) {
      clearTimeout(uiTimeout);
      uiTimeout = null;
    }
    
    if(player) {
      player.removeEventListener('play', play, 0);
      player = null;
    }

    if (acuantCamera) {
      acuantCamera.removeEventListener('acuantcameracreated', onTap);
    }
    if (uiCanvas) {
      uiCanvas.removeEventListener('click', onTap);
      uiCanvas.getContext("2d").clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    }
    AcuantCamera.end();
  }

  function start(captureCb, errorCb, options) {
    errorCallback = errorCb;
    if (options) {
      userOptions = options
    }
    if (AcuantCamera.isCameraSupported) {
      if (!isStarted) {
        isStarted = true;
        reset();
        startCamera(captureCb);
      } 
    }
    else {
      onError("Camera not supported.", AcuantJavascriptWebSdk.START_FAIL_CODE);
    }
  }

  function handleTime(start, count){
    if (count >= 3) {
      return true;
    } else {
      let elapsed = new Date().getTime() - start;

      if (elapsed < minTime) {
        minTime = elapsed;
      }
      if (minTime < DETECT_TIME_THRESHOLD)
        return true;
      return false;
    }

  }

  function handleLiveCapture(response, captureCb){
    if (response) {
      if (onDetectedResult && onDetectedResult.state === -1) {
        return;
      }

      if(captureCb.onFrameAvailable){
        captureCb.onFrameAvailable(response);
      }
      onDetectedResult = response;

      if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT) {
        if (timeout === null) {
          counter = new Date().getTime();
          triggerCountDown(captureCb);
        }
      } else {
        cancelCountDown();
        counter = null;
      }
    } else {
      cancelCountDown();
      counter = null;
    }
  }

  function triggerCountDown(captureCb) {
    if (timeout === null) {
      timeout = setTimeout(function () {
        onDetectedResult.state = UI_STATE.CAPTURING;
        capture(captureCb, "AUTO");
      }, TRIGGER_TIME);
    }
  }

  function cancelCountDown() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  }

  function startTapToCapture(captureCb){
    onDetectedResult = {
      state: UI_STATE.TAP_TO_CAPTURE
    };
    uiCanvas.addEventListener('click', onTap, false);
    uiCanvas.callback = captureCb;
  }

  function onTap(event){
    capture(event.currentTarget.callback, "TAP");
  }

  function startCamera(captureCb) {
    var count = 0;
    var startTime = new Date().getTime();

    acuantCamera = document.getElementById('acuant-camera');
    if (acuantCamera) {
      acuantCamera.addEventListener('acuantcameracreated', () => {
        player = document.getElementById('acuant-player');
        uiCanvas = document.getElementById('acuant-ui-canvas');
        uiContext = uiCanvas.getContext('2d');
  
        uiCanvas.setAttribute('role', 'img');
        player.addEventListener('play', play, 0);
      });
    }

    AcuantCamera.start((response) => {
      if (handleTime(startTime, count)) {
        if (minTime < DETECT_TIME_THRESHOLD) {
          handleLiveCapture(response, captureCb);
        } else {
          startTapToCapture(captureCb);
        }
      } else {
        count += 1;
        startTime = new Date().getTime();
        AcuantCamera.setRepeatFrameProcessor();
      }
    }, captureCb, onError);
  }

  function capture(captureCb, capType) {
    AcuantCamera.triggerCapture((response) => {
      end();
      if (document.fullscreenElement) {
        document.exitFullscreen().then(() => {
          captureCb.onCaptured(response);
        })
      }
      else {
        captureCb.onCaptured(response);
      }

      AcuantCamera.evaluateImage(response.data, response.width, response.height, capType, (result) => {
        captureCb.onCropped(result);
      });
    });
  }

  function onError(error, code) {
    end();
    if (errorCallback) {
      errorCallback(error, code);
    }
    errorCallback = null;
  }

  //TODO We can theoretically get rid of this and only draw when a new detect result comes back
  // in practice this slows down both detect and the ui, needs further investigation.
  function play() {
    (function loopUi() {
      if (player && !player.paused && !player.ended && isStarted) {
        handleUi();
        
        //Drawing at 10 fps at most (mostly done for performance on lower end devices).
        // Dont use set interval as it seems to queue calls potentially freezing page.
        uiTimeout = setTimeout(loopUi, 100);
      }
    })();
  }

  function drawText(text, fontWeight = 0.04, color = "#ffffff", showBackRect = true) {
    let dimension = getDimension();
    let currentOrientation = window.orientation;
    let measured = uiContext.measureText(text);

    let offsetY = (Math.max(dimension.width, dimension.height) * 0.01);
    let offsetX = (Math.max(dimension.width, dimension.height) * 0.02);

    var x = (dimension.height - offsetX - measured.width) / 2;
    var y = -((dimension.width / 2) - offsetY);
    var rotation = 90

    if (currentOrientation !== 0) {
      rotation = 0;
      x = (dimension.width - offsetY - measured.width) / 2;
      y = (dimension.height / 2) - offsetX + (Math.max(dimension.width, dimension.height) * 0.04);
    }

    uiContext.rotate(rotation * Math.PI / 180);

    if (showBackRect) {
      uiContext.fillStyle = "rgba(0, 0, 0, 0.5)";
      uiContext.fillRect(x - offsetY, y + offsetY, measured.width + offsetX, -(Math.max(dimension.width, dimension.height) * 0.05));
    }

    uiContext.font = (Math.ceil(Math.max(dimension.width, dimension.height) * fontWeight) || 0) + "px Sans-serif";
    uiContext.fillStyle = color;
    uiContext.fillText(text, x, y);
    updateUiStateTextElement(text);
    uiContext.restore();
  }

  const updateUiStateTextElement = (text) => {
    if (!uiStateTextElement) {
      uiStateTextElement = document.createElement('p');
      uiStateTextElement.id = 'doc-state-text';
      uiStateTextElement.style.height = '1px';
      uiStateTextElement.style.width = '1px';
      uiStateTextElement.style.margin = '-1px';
      uiStateTextElement.style.overflow = 'hidden';
      uiStateTextElement.style.position = 'absolute';
      uiStateTextElement.style.whiteSpace = 'nowrap';
      uiStateTextElement.setAttribute('role', 'alert');
      uiStateTextElement.setAttribute('aria-live', 'assertive');
      uiCanvas.parentNode.insertBefore(uiStateTextElement, uiCanvas);
    }
    if (uiStateTextElement.innerHTML != text) {
      uiStateTextElement.innerHTML = text;
    }
  }

  function isSafari() {
    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('safari') != -1) {
      if (ua.indexOf('chrome') > -1) {
        return false;
      } else {
        return true;
      }
    }
    return false;
  }

  function getDimension() {
    if (isSafari()) {
      return {
        height: Math.min(document.body.clientHeight, uiCanvas.height),
        width: Math.min(document.body.clientWidth, uiCanvas.width)
      }
    }
    else {
      return {
        height: uiCanvas.height,
        width: uiCanvas.width
      }
    }
  }

  function drawCorners(point, index) {
    let currentOrientation = window.orientation;
    let dimension = getDimension();
    var offsetX = dimension.width * 0.08;
    var offsetY = dimension.height * 0.07;

    if (currentOrientation !== 0) {
      offsetX = dimension.width * 0.07;
      offsetY = dimension.height * 0.08;
    }

    switch (index.toString()) {
      case "1":
        offsetX = -offsetX;
        break;
      case "2":
        offsetX = -offsetX;
        offsetY = -offsetY;
        break;
      case "3":
        offsetY = -offsetY;
        break;
      default:
        break;
    }
    drawCorner(point, offsetX, offsetY);
  }

  function handleUi() {

    //TODO something like the below would be good, but was not working right now. Since we are rushed for a release can be left for later. 
    // Essentially there is no reason to redraw the ui if nothing changed, but right now we do.

    // if (onDetectedResult) {
    //   console.log(onDetectedResult.state, previousState);

    //   if (previousState === onDetectedResult.state && 
    //     onDetectedResult.state != AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT && 
    //     onDetectedResult.state != AcuantCamera.DOCUMENT_STATE.CAPTURING) {
    //     previousState = onDetectedResult.state;
    //     return;
    //   }

    //   previousState = onDetectedResult.state;
    // }

    uiContext.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    
    if (!onDetectedResult) {
      drawPoints("#000000");
      drawText(userOptions.text.NONE);
    } else if (onDetectedResult.state === UI_STATE.CAPTURING) {
      drawPoints("#00ff00");
      drawOverlay("rgba(0, 255, 0, 0.2)");
      drawText(userOptions.text.CAPTURING, 0.05, "#00ff00", false);
    } else if (onDetectedResult.state === UI_STATE.TAP_TO_CAPTURE) {
      drawPoints("#000000");
      drawText(userOptions.text.TAP_TO_CAPTURE);
    } else if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT) {
      drawPoints("#ffff00");
      drawOverlay("rgba(255, 255, 0, 0.2)");

      if (userOptions.text.GOOD_DOCUMENT) {
        drawText(userOptions.text.GOOD_DOCUMENT, 0.09, "#ff0000", false);
      } else {
        let diff = Math.ceil((TRIGGER_TIME - (new Date().getTime() - counter)) / 1000)
        if (diff <= 0) {
          diff = 1;
        }
        drawText(diff + "...", 0.09, "#ff0000", false);
      }

    } else if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.SMALL_DOCUMENT) {
      drawPoints("#ff0000");
      drawText(userOptions.text.SMALL_DOCUMENT);
    } else {
      drawPoints("#000000");
      drawText(userOptions.text.NONE);
    }
  }

  function drawOverlay(style) {
    if (onDetectedResult && onDetectedResult.points && onDetectedResult.points.length === 4) {
      uiContext.beginPath();

      uiContext.moveTo(onDetectedResult.points[0].x, onDetectedResult.points[0].y);

      for (var i = 1; i < onDetectedResult.points.length; i++) {
        uiContext.lineTo(onDetectedResult.points[i].x, onDetectedResult.points[i].y);
      }
      uiContext.fillStyle = style;
      uiContext.strokeStyle = "rgba(0, 0, 0, 0)";
      uiContext.stroke();
      uiContext.fill();
    }
  }

  function drawCorner(point, offsetX, offsetY) {
    uiContext.beginPath();
    uiContext.moveTo(point.x, point.y);
    uiContext.lineTo(point.x + offsetX, point.y)
    uiContext.stroke();
    uiContext.moveTo(point.x, point.y);
    uiContext.lineTo(point.x, point.y + offsetY);
    uiContext.stroke();
  }

  function drawPoints(fillStyle) {
    let dimension = getDimension();
    uiContext.lineWidth = (Math.ceil(Math.max(dimension.width, dimension.height) * 0.0025) || 1);
    uiContext.strokeStyle = fillStyle;
    if (onDetectedResult && onDetectedResult.points && (onDetectedResult.state === -1 || onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT)) {
      for (var i in onDetectedResult.points) {
        drawCorners(onDetectedResult.points[i], i);
      }
    } else {
      var center = {
        x: dimension.width / 2,
        y: dimension.height / 2
      }

      var offsetX, offsetY;
      let targetWidth, targetHeight;

      if (dimension.width > dimension.height) {
        targetWidth = 0.85 * dimension.width;
        targetHeight = 0.85 * dimension.width / 1.58870;
        if (targetHeight > 0.85 * dimension.height) {
          targetWidth = targetWidth / targetHeight * 0.85 * dimension.height;
          targetHeight = 0.85 * dimension.height;
        }
      } else {
        targetWidth = 0.85 * dimension.height / 1.58870;
        targetHeight = 0.85 * dimension.height;
        if (targetWidth > 0.85 * dimension.width) {
          targetHeight = targetHeight / targetWidth * 0.85 * dimension.width;
          targetWidth = 0.85 * dimension.width;
        }
      }

      offsetX = targetWidth / 2;
      offsetY = targetHeight / 2;

      let defaultCorners = [
        { x: center.x - offsetX, y: center.y - offsetY },
        { x: center.x + offsetX, y: center.y - offsetY },
        { x: center.x + offsetX, y: center.y + offsetY },
        { x: center.x - offsetX, y: center.y + offsetY }
      ];

      defaultCorners.forEach((point, i) => {
        drawCorners(point, i);
      });
    }
  }

  return svc;

})();

var AcuantCamera = (function () {
    'use strict';
    let player = null;
    let uiCanvas = null;
    let uiContext = null;
    let manualCaptureInput = null;
    let hiddenCanvas = null;
    let hiddenContext = null;

    const SEQUENCE_BREAK = "Camera capture failed due to unexpected sequence break. This can currently be caused intermitently by a bug in ios 15+ related to GPU Highwater errors. Swap to manual capture until the user fully reloads the browser. Attempting to continue to use live capture can cause greater issues.";

    const DOCUMENT_STATE = {
        NO_DOCUMENT: 0,
        SMALL_DOCUMENT: 1,
        GOOD_DOCUMENT: 2
    };

    const ACUANT_DOCUMENT_TYPE = {
        NONE: 0,
        ID: 1,
        PASSPORT: 2
    }

    const TARGET_LONGSIDE_SCALE = 700;
    const TARGET_SHORTSIDE_SCALE = 500;

    let onDetectCallback = null;
    let onErrorCallback = null;
    let onManualCaptureCallback = null;
    let isStarted = false;
    let isDetecting = false;
    let detectTimeout = null;
    let acuantCamera;

    let svc = {
        start: start,
        startManualCapture: startManualCapture,
        triggerCapture: triggerCapture,
        end: endCamera,
        DOCUMENT_STATE: DOCUMENT_STATE,
        ACUANT_DOCUMENT_TYPE: ACUANT_DOCUMENT_TYPE,
        isCameraSupported: 'mediaDevices' in navigator && mobileCheck(),
        isIOSWebview: webViewCheck(),
        isIOS: isIOS,
        setRepeatFrameProcessor: setRepeatFrameProcessor,
        evaluateImage: evaluateImage
    };
    
    function webViewCheck() {
        var standalone = window.navigator.standalone,
        userAgent = window.navigator.userAgent.toLowerCase(),
        safari = /safari/.test( userAgent ),
        ios = /iphone|ipod|ipad/.test( userAgent );
    
        return (ios && !safari && !standalone);
    }

    function iOSversion() {
        if (/iP(hone|od|ad)/.test(navigator.platform)) {
            // supports iOS 2.0 and later: <http://bit.ly/TJjs1V>
            var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
            return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
        }
        return ""
    }

    function isFireFox(){
        return navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    }

    function checkIOSVersion() {
        return iOSversion()[0] >= 13;
    }

    function mobileCheck() {
        var check = false;
        (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);  
        return (check || isIOS()) && (!isFireFox());
    };

    function isIOS() {
        return ((/iPad|iPhone|iPod/.test(navigator.platform) && checkIOSVersion()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    }

    //need to investigate why adding max is causing the focal length/depth of field to change
    // let constraintWidth = 1440;

    // var userConfig = {
    //     targetWidth: (window.innerWidth || 950),
    //     targetHeight: (window.innerHeight),
    //     frameScale: 1,
    //     primaryConstraints: {
    //         video: {
    //             facingMode: { exact: "environment" },
    //             height: { min: constraintWidth, ideal: constraintWidth, max: Math.floor(constraintWidth * 1.5) },
    //             width: { min: Math.floor(constraintWidth * getAspectRatio() * 0.9), max: Math.floor(constraintWidth * getAspectRatio() * 1.5) },
    //             aspectRatio: getAspectRatio(),

    //             //This might help performance, especially on low end devices. Might be less important after apple fixes the ios 15 bug, 
    //             // but right now we want to do as little redraws as possible to avoid GPU load.
    //             frameRate: { min: 10, ideal: 15, max: 24 } 
    //         }
    //     }
    // };

    var userConfig = {
        targetWidth: (window.innerWidth || 950),
        targetHeight: (window.innerHeight),
        frameScale: 1,
        primaryConstraints: {
            video: {
                facingMode: { exact: "environment" },
                height: { min: 1440, ideal: 1440 },
                aspectRatio: getAspectRatio(),
                resizeMode: "none",

                //This might help performance, especially on low end devices. Might be less important after apple fixes the ios 15 bug, 
                // but right now we want to do as little redraws as possible to avoid GPU load.
                frameRate: { min: 10, ideal: 15, max: 24 } 
            }
        }
    };

    //1.3333 aspect ratio and lower ideal height seems to result in better focus and higher dpi on ios devices.
    // I believe this is because the true ratio of the camera is 4:3 so this ratio means people do not need to get as close 
    // to the id to get good dpi. Cameras might struggle to focus at very close angles.
    function getAspectRatio() {
        if (isIOS()) {
            return 4 / 3;
        }
        return Math.max(window.innerWidth, window.innerHeight) * 1.0 / Math.min(window.innerWidth, window.innerHeight);
    }

    function enableCamera(stream){
        isStarted = true;
        player.srcObject = stream;
        addEvents();
        player.play();
    }

    function callCameraError(error, code) {
        document.cookie = "AcuantCameraHasFailed=" + code;
        endCamera();
        if (onErrorCallback && typeof (onErrorCallback) === "function") {
            if (document.fullscreenElement) {
                document.exitFullscreen().then(() => {
                    onErrorCallback(error, code);
                })
            }
            else {
                onErrorCallback(error, code);
            }
        } else {
            console.error("No error callback set. Review implementation.");
            console.error(error, code);
        }
    }

    //sets up constraints to target the best camera. I think this is what the original implementer went off of:
    //https://old.reddit.com/r/javascript/comments/8eg8w5/choosing_cameras_in_javascript_with_the/
    //could be prone to error
    function getDevice(constraints) {
        navigator.mediaDevices.enumerateDevices()
            .then(function(devices) {
                var min = undefined;
                devices.forEach(function(device) {
                    if (device.label && device.label.indexOf("back") !== -1) {
                        let split = device.label.split(',')
                        let type = parseInt(split[0][split[0].length -1]);

                        if (type || type === 0) {
                            if (min === undefined || min > type) {
                                min = type;
                                constraints.video.deviceId = device.deviceId;
                            }
                        }
                    }
                });
                startCamera(constraints);
            })
            .catch(function(_) {
                startCamera(constraints);
            });
    }

    function startCamera(constraints) {

        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {
                //there is a third party library called screenfully which could enable fullscreen behavior in safari.
                if (isSafari()) {
                    enableCamera(stream);
                }
                else {
                    requestFullScreen(stream);
                }

            
            })
            .catch((error) => {
                callCameraError(error, AcuantJavascriptWebSdk.START_FAIL_CODE);
            });
    }

    function requestFullScreen(stream) {
        acuantCamera.requestFullscreen()
            .then(function () {
                enableCamera(stream)
            })
            .catch(function (_) {
                enableCamera(stream)
            });

    }

    //because of an ios bug to do with rotation this method will get called on rotation as the workaround
    //that we have come up with is to close and reboot the camera on rotation. (SEE MOBILE-1250). As such
    //the method needs to be able to handle cases where it is called more than once.
    function start(callback, manualCallback, errorCallback) {

        if (errorCallback) {
            onErrorCallback = errorCallback;
        }

        if (cameraHasFailedBefore()) {
            errorCallback("Live capture has previously failed and was called again. User was sent to manual capture.", AcuantJavascriptWebSdk.REPEAT_FAIL_CODE);
            startManualCapture(manualCallback);
            return;
        }

        acuantCamera=document.getElementById("acuant-camera");

        if(!acuantCamera) {
            callCameraError("Expected div with 'acuant-camera' id", AcuantJavascriptWebSdk.START_FAIL_CODE);
            return;
        }

        acuantCamera.style.position='relative';
        acuantCamera.style.boxSizing='border-box';

        acuantCamera.innerHTML=
            '<video id="acuant-player" width="100%" height="auto" autoplay playsinline style="display:block; image-orientation:none;"></video>' +
            '<canvas id="acuant-ui-canvas" width="100%" height="auto" style="display:block; position:absolute; top:0; left:0;"></canvas>';

        player = document.getElementById('acuant-player');

        hiddenCanvas = document.createElement('canvas');
        hiddenContext = hiddenCanvas.getContext('2d');
        uiCanvas = document.getElementById('acuant-ui-canvas');

        if (isStarted) {
            callCameraError("already started.", AcuantJavascriptWebSdk.START_FAIL_CODE);
        }
        else if (!player || !uiCanvas) {
            callCameraError("Missing HTML elements.", AcuantJavascriptWebSdk.START_FAIL_CODE);
        }
        else {
            uiContext = uiCanvas.getContext('2d');
            if (callback) {
                onDetectCallback = callback;
            }

            acuantCamera.dispatchEvent(new Event('acuantcameracreated'));
            getDevice(userConfig.primaryConstraints);
        }
    }

    function startManualCapture(callback) {
        onManualCaptureCallback = callback;
        if (!manualCaptureInput) {
            manualCaptureInput = document.createElement("input");
            manualCaptureInput.type = "file";
            manualCaptureInput.capture = "environment";
            manualCaptureInput.accept = "image/*";
            manualCaptureInput.onclick = function(event) {
                if(event && event.target){
                    event.target.value = '';
                }
            }
        }
        manualCaptureInput.onchange = onManualCapture;
        manualCaptureInput.click();
    }

    function arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    function getOrientation(e) {
        var view = new DataView(e.target.result);
        if (view.getUint16(0, false) != 0xFFD8) {
            return -2;
        }
        var length = view.byteLength, offset = 2;
        while (offset < length) {
            if (view.getUint16(offset + 2, false) <= 8) return -1;
            var marker = view.getUint16(offset, false);
            offset += 2;
            if (marker == 0xFFE1) {
                if (view.getUint32(offset += 2, false) != 0x45786966) {
                    return -1;
                }

                var little = view.getUint16(offset += 6, false) == 0x4949;
                offset += view.getUint32(offset + 4, little);
                var tags = view.getUint16(offset, little);
                offset += 2;
                for (var i = 0; i < tags; i++) {
                    if (view.getUint16(offset + (i * 12), little) == 0x0112) {
                        return view.getUint16(offset + (i * 12) + 8, little);
                    }
                }
            }
            else if ((marker & 0xFF00) != 0xFF00) {
                break;
            }
            else {
                offset += view.getUint16(offset, false);
            }
        }
        return -1;
    }

    let captureOrientation = -1;

    function onManualCapture(event) {        
        let file = event.target,
            reader = new FileReader();

        hiddenCanvas = document.createElement('canvas');
        hiddenContext = hiddenCanvas.getContext('2d');

        reader.onload = (e) => {
            captureOrientation = getOrientation(e);
            let image = document.createElement('img');
            image.src = 'data:image/jpeg;base64,' + arrayBufferToBase64(e.target.result);
            image.onload = () => {
                
                let MAX_WIDTH = 2560,
                    MAX_HEIGHT = 1920,
                    width = image.width,
                    height = image.height;

                var largerDimension = width > height ? width : height;

                if (largerDimension > MAX_WIDTH) {
                    if (width < height) {
                        var aspectRatio = height / width;
                        MAX_HEIGHT = MAX_WIDTH;
                        MAX_WIDTH = MAX_HEIGHT / aspectRatio;
                    }
                    else {
                        var aspectRatio = width / height;
                        MAX_HEIGHT = MAX_WIDTH / aspectRatio;
                    }
                } else {
                    MAX_WIDTH = image.width;
                    MAX_HEIGHT = image.height;
                }

                hiddenCanvas.width = MAX_WIDTH;
                hiddenCanvas.height = MAX_HEIGHT;

                hiddenContext.mozImageSmoothingEnabled = false;
                hiddenContext.webkitImageSmoothingEnabled = false;
                hiddenContext.msImageSmoothingEnabled = false;
                hiddenContext.imageSmoothingEnabled = false;

                hiddenContext.drawImage(image, 0, 0, MAX_WIDTH, MAX_HEIGHT);

                width = MAX_WIDTH;
                height = MAX_HEIGHT;

                var imgData = hiddenContext.getImageData(0, 0, width, height);

                hiddenContext.clearRect(0, 0, MAX_WIDTH, MAX_HEIGHT);
                image.remove();

                onManualCaptureCallback.onCaptured({
                    data:imgData,
                    width: width,
                    height: height
                });

                evaluateImage(imgData, width, height, "MANUAL", onManualCaptureCallback.onCropped)

            }
        }
        
        if(file && file.files[0]){
            reader.readAsArrayBuffer(file.files[0]);
        }
    }

    function isSafari() {
        var ua = navigator.userAgent.toLowerCase();
        if (ua.indexOf('safari') != -1) {
            if (ua.indexOf('chrome') > -1) {
                return false;
            } else {
                return true;
            }
        }
        return false;
    }

    function endCamera() {
        isStarted = false;
        isDetecting = false;
        captureOrientation = -1;
        if (detectTimeout) {
            clearTimeout(detectTimeout);
            detectTimeout = null;
        }

        removeEvents();

        if (player) {
            player.pause();
            if (player.srcObject) {
                player.srcObject.getTracks().forEach((t) => {
                    t.stop();
                });
            }
            player = null;
        }
        
        if (acuantCamera) {
            acuantCamera.innerHTML = '';
        }

        if (manualCaptureInput) {
            manualCaptureInput.remove();
            manualCaptureInput = null;
        }
    }

    function iOSversion() {
        if (/iP(hone|od|ad)/.test(navigator.platform)) {
            // supports iOS 2.0 and later: <http://bit.ly/TJjs1V>
            var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
            return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
        }
        return -1;
    }

    function isiOS144Plus() {
        let ver = iOSversion();
        return ver && ver != -1 && ver.length >= 2 && ver[0] == 14 && ver[1] >= 4//TODO review this is it still applicable, should it apply to ios15+
    }

    function onResize() {
        uiContext.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    
        if (player) {
            if (isIOS() && isiOS144Plus()) {
                endCamera();

                start();
            } else {
                setDimens();
            }
        }
    }

    function setDimens() {
        var targetWidth = 0;
        var targetHeight = 0;

        //not sure if this check is needed, but the original implementation had it so I left it.
        //seems to work without it tho.
        if (isSafari()) {
            targetWidth = document.body.clientWidth;
            targetHeight = document.body.clientHeight;
        } else {
            targetWidth = window.innerWidth;
            targetHeight = window.innerHeight;
        }

        if (player.videoWidth < player.videoHeight) {
            userConfig.canvasScale = (player.videoHeight / player.videoWidth);
        }
        else {
            userConfig.canvasScale = (player.videoWidth / player.videoHeight);
        }

        if (window.matchMedia("(orientation: portrait)").matches) {
            player.width = uiCanvas.width = targetWidth;
            player.height = uiCanvas.height = targetWidth * userConfig.canvasScale;
        }
        else {
            player.width = uiCanvas.width = targetHeight * userConfig.canvasScale;
            player.height = uiCanvas.height = targetHeight;
        }
    }

    function onLoadedMetaData() {
        if (player.videoWidth + player.videoHeight < 1000) {
            endCamera();
            callCameraError("Camera not supported", AcuantJavascriptWebSdk.START_FAIL_CODE);
        }
        else {
            setDimens();
            (function loopDetect() {
                if (player && !player.paused) {
                  setRepeatFrameProcessor();
                  detectTimeout = setTimeout(loopDetect, 100); // detecting at most 10 times a second, short circuits out very quickly if detect is running
              }
            })();
        }
    }

    function removeEvents() {
        window.removeEventListener('resize', onResize);
        if (player) {
            player.removeEventListener('loadedmetadata', onLoadedMetaData);
        }
    }

    function addEvents() {
        window.addEventListener('resize', onResize);
        if (player) {
            player.addEventListener('loadedmetadata', onLoadedMetaData);
        }
    }

    let imgDataPrevious;

    function setRepeatFrameProcessor() {
        if (!isStarted || isDetecting) {
            return;
        }
        if (player.videoWidth == 0) {
            sequenceBreak();
            return;
        }
        isDetecting = true;

        let max = Math.max(player.videoWidth, player.videoHeight)
        let min = Math.min(player.videoWidth, player.videoHeight)

        if (max > TARGET_LONGSIDE_SCALE && min > TARGET_SHORTSIDE_SCALE) {
            if (player.videoWidth >= player.videoHeight) {
                userConfig.frameScale = (TARGET_LONGSIDE_SCALE / player.videoWidth)
                hiddenCanvas.width = TARGET_LONGSIDE_SCALE;
                hiddenCanvas.height = player.videoHeight * userConfig.frameScale;
            }
            else {
                userConfig.frameScale = (TARGET_LONGSIDE_SCALE / player.videoHeight)
                hiddenCanvas.width = player.videoWidth * userConfig.frameScale;
                hiddenCanvas.height = TARGET_LONGSIDE_SCALE;
            }
        }
        else {
            userConfig.frameScale = 1;
            hiddenCanvas.width = player.videoWidth;
            hiddenCanvas.height = player.videoHeight;
        }

        if (isStarted) {
            let imgData;
            try {
                hiddenContext.drawImage(player, 0, 0, player.videoWidth, player.videoHeight, 0, 0, hiddenCanvas.width, hiddenCanvas.height); //this scales down to target size
                imgData = hiddenContext.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
                hiddenContext.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
            } catch (e) {
                sequenceBreak();
                return;
            }

            if (isIOS()) {
                //this is part of the mitigation of the ios 15 issue. When the camera fails it will either set video width to 0 (caught above), return a blank image (caught by this), or return the last successful frame over and over (caught by this).
                if (imgDataPrevious && arraysEqualish(imgDataPrevious.data, imgData.data)) {
                    sequenceBreak();
                    return;
                }
                imgDataPrevious = imgData;
            }

            detect(imgData, hiddenCanvas.width, hiddenCanvas.height);
        }
    }

    //Only check the first 25000 bytes for speed purposes under the assumption that camera jitter and small fluctuations in input will always lead to 
    // at least one in 25000 bytes to change. So far I have not seen thi return a false positive.
    function arraysEqualish(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length !== b.length) return false;
      
        // If you don't care about the order of the elements inside
        // the array, you should sort both arrays here.
        // Please note that calling sort on an array will modify that array.
        // you might want to clone your array first.

        let len = a.length > 25000 ? 25000 : a.length;
      
        for (var i = 0; i < len; ++i) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      }

    function detect(imgData, width, height) {
        AcuantJavascriptWebSdk.detect(imgData, width, height, {
            onSuccess: function (response) {
                if (!hiddenCanvas || !player || player.paused || player.ended)
                    return;

                response.points.forEach(p => {
                    if(p.x !== undefined && p.y !== undefined){
                        p.x = (p.x / userConfig.frameScale * player.width / player.videoWidth);
                        p.y = (p.y / userConfig.frameScale * player.height / player.videoHeight);
                    }
                });

                //cant seem to figure out the logic of the math here. Ideally if we get 600 dpi even far from the screen edges we 
                //should still mark it as an okay doc, but I tried a couple different things and could not get the theoretical dpi 
                //to match the real one.
                //
                //var dpi = (response.dpi / userConfig.frameScale * userConfig.canvasScale)
                //console.log("Response DPI: " + response.dpi + " Frame Scale: " + userConfig.frameScale + " Theoretical dpi: " + dpi)

                var isGoodDoc = (response.isCorrectAspectRatio && (/*dpi >= 600 || */(Math.min(response.dimensions.width, response.dimensions.height) / Math.min(hiddenCanvas.width, hiddenCanvas.height) > 0.75 || Math.max(response.dimensions.width, response.dimensions.height) / Math.max(hiddenCanvas.width, hiddenCanvas.height) > 0.80)))

                if (response.type === ACUANT_DOCUMENT_TYPE.NONE) {
                    response.state = DOCUMENT_STATE.NO_DOCUMENT;
                }
                else if (!isGoodDoc){
                    response.state = DOCUMENT_STATE.SMALL_DOCUMENT;
                }
                else {
                    response.state = DOCUMENT_STATE.GOOD_DOCUMENT;
                }
                onDetectCallback(response);
                isDetecting = false;
            },
            onFail: function () {
                if (!hiddenCanvas || !player || player.paused || player.ended)
                    return;

                let response = {}
                response.state = DOCUMENT_STATE.NO_DOCUMENT;
                onDetectCallback(response);
                isDetecting = false;
            }
        });
    }

    function evaluateImage(imgData, width, height, capType, callback) {

        let result = {};
        let waitingOnTheOther = true;

        AcuantJavascriptWebSdk.moire(imgData, width, height, {
            onSuccess: function (moire, moireraw) {
                result.moire = moire;
                result.moireraw = moireraw;

                if (waitingOnTheOther) {
                    waitingOnTheOther = false;
                } else {
                    finishCrop(result, width, height, capType, callback);
                }
            },

            onFail: function () {
                result.moire = -1;
                result.moireraw = -1;

                if (waitingOnTheOther) {
                    waitingOnTheOther = false;
                } else {
                    finishCrop(result, width, height, capType, callback);
                }
            }
        });

        AcuantJavascriptWebSdk.crop(imgData, width, height, {
            onSuccess: function (response) {
                result.cardtype = response.cardtype;
                result.dpi = response.dpi;
                result.image = response.image;

                if (waitingOnTheOther) {
                    waitingOnTheOther = false;
                } else {
                    finishCrop(result, width, height, capType, callback);
                }
            },

            onFail: function () {
                callback();
            }
        });
    }

    function finishCrop(result, width, height, capType, callback) {

        AcuantJavascriptWebSdk.metrics(result.image, width, height, {
            onSuccess: function (sharpness, glare) {

                result.sharpness = sharpness;
                result.glare = glare;

                result.image.data = toBase64(result, capType);
                callback(result);
            },

            onFail: function () {
                result.sharpness = -1;
                result.glare = -1;

                result.image.data = toBase64(result, capType);
                callback(result);
            }
        });
    }

    function triggerCapture(callback) {
        let imgData;
        try {
            if (player.videoWidth == 0) {
                throw "width 0";
            }
            hiddenCanvas.width = player.videoWidth;
            hiddenCanvas.height = player.videoHeight;
    
            hiddenContext.drawImage(player, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
            imgData = hiddenContext.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
            hiddenContext.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
        } catch (e) {
            sequenceBreak();
            return;
        }
        
        callback({
            data: imgData,
            width: hiddenCanvas.width,
            height:  hiddenCanvas.height
        });
    }

    function toBase64(result, capType) {
        hiddenCanvas.width = result.image.width;
        hiddenCanvas.height = result.image.height;

        let mImgData = hiddenContext.createImageData(result.image.width, result.image.height);

        setImageData(mImgData.data, result.image.data);
        hiddenContext.putImageData(mImgData, 0, 0);

        let isManual = capType != "AUTO" && capType != "TAP";

        if (result.cardtype !== 2) {
            if ((!isManual && window.matchMedia("(orientation: portrait)").matches) || (isManual && captureOrientation === 6)) {
                hiddenContext.rotate(Math.PI); //180 degrees
                //the width and height are negative as an alternative to counting out the transform needed 
                // to get to the middle of the image. Avoids possible mistakes with off by one pixel.
                hiddenContext.drawImage(hiddenCanvas, 0, 0, -hiddenCanvas.width, -hiddenCanvas.height); 
            }
        }

        result.image.bytes = hiddenContext.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height).data;

        let quality = (typeof acuantConfig !== "undefined" && typeof acuantConfig.jpegQuality === 'number') ? acuantConfig.jpegQuality : 1.0
        let base64Img = hiddenCanvas.toDataURL("image/jpeg", quality);
        hiddenContext.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);

        if (hiddenCanvas) {
            hiddenContext = null;
            hiddenCanvas.remove();
            hiddenCanvas = null;
        }

        return addExif(result, capType, base64Img);
    }

    function addExif(result, capType, base64Img){
        var zeroth = {};
        zeroth[piexif.ImageIFD.Make] = navigator.platform;
        zeroth[piexif.ImageIFD.Model] = navigator.userAgent;
        zeroth[piexif.ImageIFD.Software] = "Acuant JavascriptWeb SDK " + AcuantConfig.acuantVersion;
        zeroth[piexif.ImageIFD.ImageDescription] = JSON.stringify({
            "cvml":{ 
                "cropping":{
                    "iscropped": true,
                    "dpi": result.dpi,
                    "idsize": result.cardType === 2 ? "ID3": "ID1",
                    "elapsed": -1
                },
                "sharpness":{
                    "normalized": result.sharpness,
                    "elapsed": -1
                },
                "moire":{
                    "normalized": result.moire,
                    "raw": result.moireraw,
                    "elapsed": -1
                },
                "glare":{
                    "normalized": result.glare,
                    "elapsed": -1
                },
                "version": AcuantConfig.cvmlVersion
            },
            "device":{
                "version": getBrowserVersion(),
                "capturetype": capType
            }
        });
  
        var exifObj = {"0th":zeroth};
        var exifStr = piexif.dump(exifObj);
        return piexif.insert(exifStr, base64Img);
    }

    function getBrowserVersion(){
        var ua= navigator.userAgent, tem, 
        M= ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
        if(/trident/i.test(M[1])){
            tem=  /\brv[ :]+(\d+)/g.exec(ua) || [];
            return 'IE '+(tem[1] || '');
        }
        if(M[1]=== 'Chrome'){
            tem= ua.match(/\b(OPR|Edge)\/(\d+)/);
            if(tem!= null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
        }
        M= M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
        if((tem= ua.match(/version\/(\d+)/i))!= null) M.splice(1, 1, tem[1]);
        return M.join(' ');
    }

    function setImageData(imgData, src) {
        for (let i = 0; i < imgData.length; i++) {
            imgData[i] = src[i];
        }
    }

    function cameraHasFailedBefore() {
        let name = "AcuantCameraHasFailed=";
        let decodedCookie = decodeURIComponent(document.cookie);
        return decodedCookie.includes(name);
    }

    function sequenceBreak() {
        imgDataPrevious = undefined;
        if (onErrorCallback) {
            callCameraError(SEQUENCE_BREAK, AcuantJavascriptWebSdk.SEQUENCE_BREAK_CODE);
        }
        endCamera();
    }

    return svc;
})();
/* piexifjs

The MIT License (MIT)

Copyright (c) 2014, 2015 hMatoba(https://github.com/hMatoba)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(function () {
    "use strict";
    var that = {};
    that.version = "1.0.4";

    that.remove = function (jpeg) {
        var b64 = false;
        if (jpeg.slice(0, 2) == "\xff\xd8") {
        } else if (jpeg.slice(0, 23) == "data:image/jpeg;base64," || jpeg.slice(0, 22) == "data:image/jpg;base64,") {
            jpeg = atob(jpeg.split(",")[1]);
            b64 = true;
        } else {
            throw new Error("Given data is not jpeg.");
        }
        
        var segments = splitIntoSegments(jpeg);
        var newSegments = segments.filter(function(seg){
          return  !(seg.slice(0, 2) == "\xff\xe1" &&
                   seg.slice(4, 10) == "Exif\x00\x00"); 
        });
        
        var new_data = newSegments.join("");
        if (b64) {
            new_data = "data:image/jpeg;base64," + btoa(new_data);
        }

        return new_data;
    };


    that.insert = function (exif, jpeg) {
        var b64 = false;
        if (exif.slice(0, 6) != "\x45\x78\x69\x66\x00\x00") {
            throw new Error("Given data is not exif.");
        }
        if (jpeg.slice(0, 2) == "\xff\xd8") {
        } else if (jpeg.slice(0, 23) == "data:image/jpeg;base64," || jpeg.slice(0, 22) == "data:image/jpg;base64,") {
            jpeg = atob(jpeg.split(",")[1]);
            b64 = true;
        } else {
            throw new Error("Given data is not jpeg.");
        }

        var exifStr = "\xff\xe1" + pack(">H", [exif.length + 2]) + exif;
        var segments = splitIntoSegments(jpeg);
        var new_data = mergeSegments(segments, exifStr);
        if (b64) {
            new_data = "data:image/jpeg;base64," + btoa(new_data);
        }

        return new_data;
    };


    that.load = function (data) {
        var input_data;
        if (typeof (data) == "string") {
            if (data.slice(0, 2) == "\xff\xd8") {
                input_data = data;
            } else if (data.slice(0, 23) == "data:image/jpeg;base64," || data.slice(0, 22) == "data:image/jpg;base64,") {
                input_data = atob(data.split(",")[1]);
            } else if (data.slice(0, 4) == "Exif") {
                input_data = data.slice(6);
            } else {
                throw new Error("'load' gots invalid file data.");
            }
        } else {
            throw new Error("'load' gots invalid type argument.");
        }

        var exifDict = {};
        var exif_dict = {
            "0th": {},
            "Exif": {},
            "GPS": {},
            "Interop": {},
            "1st": {},
            "thumbnail": null
        };
        var exifReader = new ExifReader(input_data);
        if (exifReader.tiftag === null) {
            return exif_dict;
        }

        if (exifReader.tiftag.slice(0, 2) == "\x49\x49") {
            exifReader.endian_mark = "<";
        } else {
            exifReader.endian_mark = ">";
        }

        var pointer = unpack(exifReader.endian_mark + "L",
            exifReader.tiftag.slice(4, 8))[0];
        exif_dict["0th"] = exifReader.get_ifd(pointer, "0th");

        var first_ifd_pointer = exif_dict["0th"]["first_ifd_pointer"];
        delete exif_dict["0th"]["first_ifd_pointer"];

        if (34665 in exif_dict["0th"]) {
            pointer = exif_dict["0th"][34665];
            exif_dict["Exif"] = exifReader.get_ifd(pointer, "Exif");
        }
        if (34853 in exif_dict["0th"]) {
            pointer = exif_dict["0th"][34853];
            exif_dict["GPS"] = exifReader.get_ifd(pointer, "GPS");
        }
        if (40965 in exif_dict["Exif"]) {
            pointer = exif_dict["Exif"][40965];
            exif_dict["Interop"] = exifReader.get_ifd(pointer, "Interop");
        }
        if (first_ifd_pointer != "\x00\x00\x00\x00") {
            pointer = unpack(exifReader.endian_mark + "L",
                first_ifd_pointer)[0];
            exif_dict["1st"] = exifReader.get_ifd(pointer, "1st");
            if ((513 in exif_dict["1st"]) && (514 in exif_dict["1st"])) {
                var end = exif_dict["1st"][513] + exif_dict["1st"][514];
                var thumb = exifReader.tiftag.slice(exif_dict["1st"][513], end);
                exif_dict["thumbnail"] = thumb;
            }
        }

        return exif_dict;
    };


    that.dump = function (exif_dict_original) {
        var TIFF_HEADER_LENGTH = 8;

        var exif_dict = copy(exif_dict_original);
        var header = "Exif\x00\x00\x4d\x4d\x00\x2a\x00\x00\x00\x08";
        var exif_is = false;
        var gps_is = false;
        var interop_is = false;
        var first_is = false;

        var zeroth_ifd,
            exif_ifd,
            interop_ifd,
            gps_ifd,
            first_ifd;
        
        if ("0th" in exif_dict) {
            zeroth_ifd = exif_dict["0th"];
        } else {
            zeroth_ifd = {};
        }
        
        if ((("Exif" in exif_dict) && (Object.keys(exif_dict["Exif"]).length)) ||
            (("Interop" in exif_dict) && (Object.keys(exif_dict["Interop"]).length))) {
            zeroth_ifd[34665] = 1;
            exif_is = true;
            exif_ifd = exif_dict["Exif"];
            if (("Interop" in exif_dict) && Object.keys(exif_dict["Interop"]).length) {
                exif_ifd[40965] = 1;
                interop_is = true;
                interop_ifd = exif_dict["Interop"];
            } else if (Object.keys(exif_ifd).indexOf(that.ExifIFD.InteroperabilityTag.toString()) > -1) {
                delete exif_ifd[40965];
            }
        } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.ExifTag.toString()) > -1) {
            delete zeroth_ifd[34665];
        }

        if (("GPS" in exif_dict) && (Object.keys(exif_dict["GPS"]).length)) {
            zeroth_ifd[that.ImageIFD.GPSTag] = 1;
            gps_is = true;
            gps_ifd = exif_dict["GPS"];
        } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.GPSTag.toString()) > -1) {
            delete zeroth_ifd[that.ImageIFD.GPSTag];
        }
        
        if (("1st" in exif_dict) &&
            ("thumbnail" in exif_dict) &&
            (exif_dict["thumbnail"] != null)) {
            first_is = true;
            exif_dict["1st"][513] = 1;
            exif_dict["1st"][514] = 1;
            first_ifd = exif_dict["1st"];
        }
        
        var zeroth_set = _dict_to_bytes(zeroth_ifd, "0th", 0);
        var zeroth_length = (zeroth_set[0].length + exif_is * 12 + gps_is * 12 + 4 +
            zeroth_set[1].length);

        var exif_set,
            exif_bytes = "",
            exif_length = 0,
            gps_set,
            gps_bytes = "",
            gps_length = 0,
            interop_set,
            interop_bytes = "",
            interop_length = 0,
            first_set,
            first_bytes = "",
            thumbnail;
        if (exif_is) {
            exif_set = _dict_to_bytes(exif_ifd, "Exif", zeroth_length);
            exif_length = exif_set[0].length + interop_is * 12 + exif_set[1].length;
        }
        if (gps_is) {
            gps_set = _dict_to_bytes(gps_ifd, "GPS", zeroth_length + exif_length);
            gps_bytes = gps_set.join("");
            gps_length = gps_bytes.length;
        }
        if (interop_is) {
            var offset = zeroth_length + exif_length + gps_length;
            interop_set = _dict_to_bytes(interop_ifd, "Interop", offset);
            interop_bytes = interop_set.join("");
            interop_length = interop_bytes.length;
        }
        if (first_is) {
            var offset = zeroth_length + exif_length + gps_length + interop_length;
            first_set = _dict_to_bytes(first_ifd, "1st", offset);
            thumbnail = _get_thumbnail(exif_dict["thumbnail"]);
            if (thumbnail.length > 64000) {
                throw new Error("Given thumbnail is too large. max 64kB");
            }
        }

        var exif_pointer = "",
            gps_pointer = "",
            interop_pointer = "",
            first_ifd_pointer = "\x00\x00\x00\x00";
        if (exif_is) {
            var pointer_value = TIFF_HEADER_LENGTH + zeroth_length;
            var pointer_str = pack(">L", [pointer_value]);
            var key = 34665;
            var key_str = pack(">H", [key]);
            var type_str = pack(">H", [TYPES["Long"]]);
            var length_str = pack(">L", [1]);
            exif_pointer = key_str + type_str + length_str + pointer_str;
        }
        if (gps_is) {
            var pointer_value = TIFF_HEADER_LENGTH + zeroth_length + exif_length;
            var pointer_str = pack(">L", [pointer_value]);
            var key = 34853;
            var key_str = pack(">H", [key]);
            var type_str = pack(">H", [TYPES["Long"]]);
            var length_str = pack(">L", [1]);
            gps_pointer = key_str + type_str + length_str + pointer_str;
        }
        if (interop_is) {
            var pointer_value = (TIFF_HEADER_LENGTH +
                zeroth_length + exif_length + gps_length);
            var pointer_str = pack(">L", [pointer_value]);
            var key = 40965;
            var key_str = pack(">H", [key]);
            var type_str = pack(">H", [TYPES["Long"]]);
            var length_str = pack(">L", [1]);
            interop_pointer = key_str + type_str + length_str + pointer_str;
        }
        if (first_is) {
            var pointer_value = (TIFF_HEADER_LENGTH + zeroth_length +
                exif_length + gps_length + interop_length);
            first_ifd_pointer = pack(">L", [pointer_value]);
            var thumbnail_pointer = (pointer_value + first_set[0].length + 24 +
                4 + first_set[1].length);
            var thumbnail_p_bytes = ("\x02\x01\x00\x04\x00\x00\x00\x01" +
                pack(">L", [thumbnail_pointer]));
            var thumbnail_length_bytes = ("\x02\x02\x00\x04\x00\x00\x00\x01" +
                pack(">L", [thumbnail.length]));
            first_bytes = (first_set[0] + thumbnail_p_bytes +
                thumbnail_length_bytes + "\x00\x00\x00\x00" +
                first_set[1] + thumbnail);
        }

        var zeroth_bytes = (zeroth_set[0] + exif_pointer + gps_pointer +
            first_ifd_pointer + zeroth_set[1]);
        if (exif_is) {
            exif_bytes = exif_set[0] + interop_pointer + exif_set[1];
        }

        return (header + zeroth_bytes + exif_bytes + gps_bytes +
            interop_bytes + first_bytes);
    };


    function copy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }


    function _get_thumbnail(jpeg) {
        var segments = splitIntoSegments(jpeg);
        while (("\xff\xe0" <= segments[1].slice(0, 2)) && (segments[1].slice(0, 2) <= "\xff\xef")) {
            segments = [segments[0]].concat(segments.slice(2));
        }
        return segments.join("");
    }


    function _pack_byte(array) {
        return pack(">" + nStr("B", array.length), array);
    }


    function _pack_short(array) {
        return pack(">" + nStr("H", array.length), array);
    }


    function _pack_long(array) {
        return pack(">" + nStr("L", array.length), array);
    }


    function _value_to_bytes(raw_value, value_type, offset) {
        var four_bytes_over = "";
        var value_str = "";
        var length,
            new_value,
            num,
            den;

        if (value_type == "Byte") {
            length = raw_value.length;
            if (length <= 4) {
                value_str = (_pack_byte(raw_value) +
                    nStr("\x00", 4 - length));
            } else {
                value_str = pack(">L", [offset]);
                four_bytes_over = _pack_byte(raw_value);
            }
        } else if (value_type == "Short") {
            length = raw_value.length;
            if (length <= 2) {
                value_str = (_pack_short(raw_value) +
                    nStr("\x00\x00", 2 - length));
            } else {
                value_str = pack(">L", [offset]);
                four_bytes_over = _pack_short(raw_value);
            }
        } else if (value_type == "Long") {
            length = raw_value.length;
            if (length <= 1) {
                value_str = _pack_long(raw_value);
            } else {
                value_str = pack(">L", [offset]);
                four_bytes_over = _pack_long(raw_value);
            }
        } else if (value_type == "Ascii") {
            new_value = raw_value + "\x00";
            length = new_value.length;
            if (length > 4) {
                value_str = pack(">L", [offset]);
                four_bytes_over = new_value;
            } else {
                value_str = new_value + nStr("\x00", 4 - length);
            }
        } else if (value_type == "Rational") {
            if (typeof (raw_value[0]) == "number") {
                length = 1;
                num = raw_value[0];
                den = raw_value[1];
                new_value = pack(">L", [num]) + pack(">L", [den]);
            } else {
                length = raw_value.length;
                new_value = "";
                for (var n = 0; n < length; n++) {
                    num = raw_value[n][0];
                    den = raw_value[n][1];
                    new_value += (pack(">L", [num]) +
                        pack(">L", [den]));
                }
            }
            value_str = pack(">L", [offset]);
            four_bytes_over = new_value;
        } else if (value_type == "SRational") {
            if (typeof (raw_value[0]) == "number") {
                length = 1;
                num = raw_value[0];
                den = raw_value[1];
                new_value = pack(">l", [num]) + pack(">l", [den]);
            } else {
                length = raw_value.length;
                new_value = "";
                for (var n = 0; n < length; n++) {
                    num = raw_value[n][0];
                    den = raw_value[n][1];
                    new_value += (pack(">l", [num]) +
                        pack(">l", [den]));
                }
            }
            value_str = pack(">L", [offset]);
            four_bytes_over = new_value;
        } else if (value_type == "Undefined") {
            length = raw_value.length;
            if (length > 4) {
                value_str = pack(">L", [offset]);
                four_bytes_over = raw_value;
            } else {
                value_str = raw_value + nStr("\x00", 4 - length);
            }
        }

        var length_str = pack(">L", [length]);

        return [length_str, value_str, four_bytes_over];
    }

    function _dict_to_bytes(ifd_dict, ifd, ifd_offset) {
        var TIFF_HEADER_LENGTH = 8;
        var tag_count = Object.keys(ifd_dict).length;
        var entry_header = pack(">H", [tag_count]);
        var entries_length;
        if (["0th", "1st"].indexOf(ifd) > -1) {
            entries_length = 2 + tag_count * 12 + 4;
        } else {
            entries_length = 2 + tag_count * 12;
        }
        var entries = "";
        var values = "";
        var key;

        for (var key in ifd_dict) {
            if (typeof (key) == "string") {
                key = parseInt(key);
            }
            if ((ifd == "0th") && ([34665, 34853].indexOf(key) > -1)) {
                continue;
            } else if ((ifd == "Exif") && (key == 40965)) {
                continue;
            } else if ((ifd == "1st") && ([513, 514].indexOf(key) > -1)) {
                continue;
            }

            var raw_value = ifd_dict[key];
            var key_str = pack(">H", [key]);
            var value_type = TAGS[ifd][key]["type"];
            var type_str = pack(">H", [TYPES[value_type]]);

            if (typeof (raw_value) == "number") {
                raw_value = [raw_value];
            }
            var offset = TIFF_HEADER_LENGTH + entries_length + ifd_offset + values.length;
            var b = _value_to_bytes(raw_value, value_type, offset);
            var length_str = b[0];
            var value_str = b[1];
            var four_bytes_over = b[2];

            entries += key_str + type_str + length_str + value_str;
            values += four_bytes_over;
        }

        return [entry_header + entries, values];
    }



    function ExifReader(data) {
        var segments,
            app1;
        if (data.slice(0, 2) == "\xff\xd8") { // JPEG
            segments = splitIntoSegments(data);
            app1 = getExifSeg(segments);
            if (app1) {
                this.tiftag = app1.slice(10);
            } else {
                this.tiftag = null;
            }
        } else if (["\x49\x49", "\x4d\x4d"].indexOf(data.slice(0, 2)) > -1) { // TIFF
            this.tiftag = data;
        } else if (data.slice(0, 4) == "Exif") { // Exif
            this.tiftag = data.slice(6);
        } else {
            throw new Error("Given file is neither JPEG nor TIFF.");
        }
    }

    ExifReader.prototype = {
        get_ifd: function (pointer, ifd_name) {
            var ifd_dict = {};
            var tag_count = unpack(this.endian_mark + "H",
                this.tiftag.slice(pointer, pointer + 2))[0];
            var offset = pointer + 2;
            var t;
            if (["0th", "1st"].indexOf(ifd_name) > -1) {
                t = "Image";
            } else {
                t = ifd_name;
            }

            for (var x = 0; x < tag_count; x++) {
                pointer = offset + 12 * x;
                var tag = unpack(this.endian_mark + "H",
                    this.tiftag.slice(pointer, pointer + 2))[0];
                var value_type = unpack(this.endian_mark + "H",
                    this.tiftag.slice(pointer + 2, pointer + 4))[0];
                var value_num = unpack(this.endian_mark + "L",
                    this.tiftag.slice(pointer + 4, pointer + 8))[0];
                var value = this.tiftag.slice(pointer + 8, pointer + 12);

                var v_set = [value_type, value_num, value];
                if (tag in TAGS[t]) {
                    ifd_dict[tag] = this.convert_value(v_set);
                }
            }

            if (ifd_name == "0th") {
                pointer = offset + 12 * tag_count;
                ifd_dict["first_ifd_pointer"] = this.tiftag.slice(pointer, pointer + 4);
            }

            return ifd_dict;
        },

        convert_value: function (val) {
            var data = null;
            var t = val[0];
            var length = val[1];
            var value = val[2];
            var pointer;

            if (t == 1) { // BYTE
                if (length > 4) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = unpack(this.endian_mark + nStr("B", length),
                        this.tiftag.slice(pointer, pointer + length));
                } else {
                    data = unpack(this.endian_mark + nStr("B", length), value.slice(0, length));
                }
            } else if (t == 2) { // ASCII
                if (length > 4) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = this.tiftag.slice(pointer, pointer + length - 1);
                } else {
                    data = value.slice(0, length - 1);
                }
            } else if (t == 3) { // SHORT
                if (length > 2) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = unpack(this.endian_mark + nStr("H", length),
                        this.tiftag.slice(pointer, pointer + length * 2));
                } else {
                    data = unpack(this.endian_mark + nStr("H", length),
                        value.slice(0, length * 2));
                }
            } else if (t == 4) { // LONG
                if (length > 1) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = unpack(this.endian_mark + nStr("L", length),
                        this.tiftag.slice(pointer, pointer + length * 4));
                } else {
                    data = unpack(this.endian_mark + nStr("L", length),
                        value);
                }
            } else if (t == 5) { // RATIONAL
                pointer = unpack(this.endian_mark + "L", value)[0];
                if (length > 1) {
                    data = [];
                    for (var x = 0; x < length; x++) {
                        data.push([unpack(this.endian_mark + "L",
                                this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0],
                                   unpack(this.endian_mark + "L",
                                this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]
                                   ]);
                    }
                } else {
                    data = [unpack(this.endian_mark + "L",
                            this.tiftag.slice(pointer, pointer + 4))[0],
                            unpack(this.endian_mark + "L",
                            this.tiftag.slice(pointer + 4, pointer + 8))[0]
                            ];
                }
            } else if (t == 7) { // UNDEFINED BYTES
                if (length > 4) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = this.tiftag.slice(pointer, pointer + length);
                } else {
                    data = value.slice(0, length);
                }
            } else if (t == 9) { // SLONG
                if (length > 1) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = unpack(this.endian_mark + nStr("l", length),
                        this.tiftag.slice(pointer, pointer + length * 4));
                } else {
                    data = unpack(this.endian_mark + nStr("l", length),
                        value);
                }
            } else if (t == 10) { // SRATIONAL
                pointer = unpack(this.endian_mark + "L", value)[0];
                if (length > 1) {
                    data = [];
                    for (var x = 0; x < length; x++) {
                        data.push([unpack(this.endian_mark + "l",
                                this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0],
                                   unpack(this.endian_mark + "l",
                                this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]
                                  ]);
                    }
                } else {
                    data = [unpack(this.endian_mark + "l",
                            this.tiftag.slice(pointer, pointer + 4))[0],
                            unpack(this.endian_mark + "l",
                            this.tiftag.slice(pointer + 4, pointer + 8))[0]
                           ];
                }
            } else {
                throw new Error("Exif might be wrong. Got incorrect value " +
                    "type to decode. type:" + t);
            }

            if ((data instanceof Array) && (data.length == 1)) {
                return data[0];
            } else {
                return data;
            }
        },
    };


    if (typeof window !== "undefined" && typeof window.btoa === "function") {
        var btoa = window.btoa;
    }
    if (typeof btoa === "undefined") {
        var btoa = function (input) {        var output = "";
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
            var i = 0;
            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

            while (i < input.length) {

                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);

                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;

                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }

                output = output +
                keyStr.charAt(enc1) + keyStr.charAt(enc2) +
                keyStr.charAt(enc3) + keyStr.charAt(enc4);

            }

            return output;
        };
    }
    
    
    if (typeof window !== "undefined" && typeof window.atob === "function") {
        var atob = window.atob;
    }
    if (typeof atob === "undefined") {
        var atob = function (input) {
            var output = "";
            var chr1, chr2, chr3;
            var enc1, enc2, enc3, enc4;
            var i = 0;
            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

            while (i < input.length) {

                enc1 = keyStr.indexOf(input.charAt(i++));
                enc2 = keyStr.indexOf(input.charAt(i++));
                enc3 = keyStr.indexOf(input.charAt(i++));
                enc4 = keyStr.indexOf(input.charAt(i++));

                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;

                output = output + String.fromCharCode(chr1);

                if (enc3 != 64) {
                    output = output + String.fromCharCode(chr2);
                }
                if (enc4 != 64) {
                    output = output + String.fromCharCode(chr3);
                }

            }

            return output;
        };
    }


    function getImageSize(imageArray) {
        var segments = slice2Segments(imageArray);
        var seg,
            width,
            height,
            SOF = [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207];

        for (var x = 0; x < segments.length; x++) {
            seg = segments[x];
            if (SOF.indexOf(seg[1]) >= 0) {
                height = seg[5] * 256 + seg[6];
                width = seg[7] * 256 + seg[8];
                break;
            }
        }
        return [width, height];
    }


    function pack(mark, array) {
        if (!(array instanceof Array)) {
            throw new Error("'pack' error. Got invalid type argument.");
        }
        if ((mark.length - 1) != array.length) {
            throw new Error("'pack' error. " + (mark.length - 1) + " marks, " + array.length + " elements.");
        }

        var littleEndian;
        if (mark[0] == "<") {
            littleEndian = true;
        } else if (mark[0] == ">") {
            littleEndian = false;
        } else {
            throw new Error("");
        }
        var packed = "";
        var p = 1;
        var val = null;
        var c = null;
        var valStr = null;

        while (c = mark[p]) {
            if (c.toLowerCase() == "b") {
                val = array[p - 1];
                if ((c == "b") && (val < 0)) {
                    val += 0x100;
                }
                if ((val > 0xff) || (val < 0)) {
                    throw new Error("'pack' error.");
                } else {
                    valStr = String.fromCharCode(val);
                }
            } else if (c == "H") {
                val = array[p - 1];
                if ((val > 0xffff) || (val < 0)) {
                    throw new Error("'pack' error.");
                } else {
                    valStr = String.fromCharCode(Math.floor((val % 0x10000) / 0x100)) +
                        String.fromCharCode(val % 0x100);
                    if (littleEndian) {
                        valStr = valStr.split("").reverse().join("");
                    }
                }
            } else if (c.toLowerCase() == "l") {
                val = array[p - 1];
                if ((c == "l") && (val < 0)) {
                    val += 0x100000000;
                }
                if ((val > 0xffffffff) || (val < 0)) {
                    throw new Error("'pack' error.");
                } else {
                    valStr = String.fromCharCode(Math.floor(val / 0x1000000)) +
                        String.fromCharCode(Math.floor((val % 0x1000000) / 0x10000)) +
                        String.fromCharCode(Math.floor((val % 0x10000) / 0x100)) +
                        String.fromCharCode(val % 0x100);
                    if (littleEndian) {
                        valStr = valStr.split("").reverse().join("");
                    }
                }
            } else {
                throw new Error("'pack' error.");
            }

            packed += valStr;
            p += 1;
        }

        return packed;
    }

    function unpack(mark, str) {
        if (typeof (str) != "string") {
            throw new Error("'unpack' error. Got invalid type argument.");
        }
        var l = 0;
        for (var markPointer = 1; markPointer < mark.length; markPointer++) {
            if (mark[markPointer].toLowerCase() == "b") {
                l += 1;
            } else if (mark[markPointer].toLowerCase() == "h") {
                l += 2;
            } else if (mark[markPointer].toLowerCase() == "l") {
                l += 4;
            } else {
                throw new Error("'unpack' error. Got invalid mark.");
            }
        }

        if (l != str.length) {
            throw new Error("'unpack' error. Mismatch between symbol and string length. " + l + ":" + str.length);
        }

        var littleEndian;
        if (mark[0] == "<") {
            littleEndian = true;
        } else if (mark[0] == ">") {
            littleEndian = false;
        } else {
            throw new Error("'unpack' error.");
        }
        var unpacked = [];
        var strPointer = 0;
        var p = 1;
        var val = null;
        var c = null;
        var length = null;
        var sliced = "";

        while (c = mark[p]) {
            if (c.toLowerCase() == "b") {
                length = 1;
                sliced = str.slice(strPointer, strPointer + length);
                val = sliced.charCodeAt(0);
                if ((c == "b") && (val >= 0x80)) {
                    val -= 0x100;
                }
            } else if (c == "H") {
                length = 2;
                sliced = str.slice(strPointer, strPointer + length);
                if (littleEndian) {
                    sliced = sliced.split("").reverse().join("");
                }
                val = sliced.charCodeAt(0) * 0x100 +
                    sliced.charCodeAt(1);
            } else if (c.toLowerCase() == "l") {
                length = 4;
                sliced = str.slice(strPointer, strPointer + length);
                if (littleEndian) {
                    sliced = sliced.split("").reverse().join("");
                }
                val = sliced.charCodeAt(0) * 0x1000000 +
                    sliced.charCodeAt(1) * 0x10000 +
                    sliced.charCodeAt(2) * 0x100 +
                    sliced.charCodeAt(3);
                if ((c == "l") && (val >= 0x80000000)) {
                    val -= 0x100000000;
                }
            } else {
                throw new Error("'unpack' error. " + c);
            }

            unpacked.push(val);
            strPointer += length;
            p += 1;
        }

        return unpacked;
    }

    function nStr(ch, num) {
        var str = "";
        for (var i = 0; i < num; i++) {
            str += ch;
        }
        return str;
    }

    function splitIntoSegments(data) {
        if (data.slice(0, 2) != "\xff\xd8") {
            throw new Error("Given data isn't JPEG.");
        }

        var head = 2;
        var segments = ["\xff\xd8"];
        while (true) {
            if (data.slice(head, head + 2) == "\xff\xda") {
                segments.push(data.slice(head));
                break;
            } else {
                var length = unpack(">H", data.slice(head + 2, head + 4))[0];
                var endPoint = head + length + 2;
                segments.push(data.slice(head, endPoint));
                head = endPoint;
            }

            if (head >= data.length) {
                throw new Error("Wrong JPEG data.");
            }
        }
        return segments;
    }


    function getExifSeg(segments) {
        var seg;
        for (var i = 0; i < segments.length; i++) {
            seg = segments[i];
            if (seg.slice(0, 2) == "\xff\xe1" &&
                   seg.slice(4, 10) == "Exif\x00\x00") {
                return seg;
            }
        }
        return null;
    }


    function mergeSegments(segments, exif) {
        var hasExifSegment = false;
        var additionalAPP1ExifSegments = [];

        segments.forEach(function(segment, i) {
            // Replace first occurence of APP1:Exif segment
            if (segment.slice(0, 2) == "\xff\xe1" &&
                segment.slice(4, 10) == "Exif\x00\x00"
            ) {
                if (!hasExifSegment) {
                    segments[i] = exif;
                    hasExifSegment = true;
                } else {
                    additionalAPP1ExifSegments.unshift(i);
                }
            }
        });

        // Remove additional occurences of APP1:Exif segment
        additionalAPP1ExifSegments.forEach(function(segmentIndex) {
            segments.splice(segmentIndex, 1);
        });

        if (!hasExifSegment && exif) {
            segments = [segments[0], exif].concat(segments.slice(1));
        }

        return segments.join("");
    }


    function toHex(str) {
        var hexStr = "";
        for (var i = 0; i < str.length; i++) {
            var h = str.charCodeAt(i);
            var hex = ((h < 10) ? "0" : "") + h.toString(16);
            hexStr += hex + " ";
        }
        return hexStr;
    }


    var TYPES = {
        "Byte": 1,
        "Ascii": 2,
        "Short": 3,
        "Long": 4,
        "Rational": 5,
        "Undefined": 7,
        "SLong": 9,
        "SRational": 10
    };


    var TAGS = {
        'Image': {
            11: {
                'name': 'ProcessingSoftware',
                'type': 'Ascii'
            },
            254: {
                'name': 'NewSubfileType',
                'type': 'Long'
            },
            255: {
                'name': 'SubfileType',
                'type': 'Short'
            },
            256: {
                'name': 'ImageWidth',
                'type': 'Long'
            },
            257: {
                'name': 'ImageLength',
                'type': 'Long'
            },
            258: {
                'name': 'BitsPerSample',
                'type': 'Short'
            },
            259: {
                'name': 'Compression',
                'type': 'Short'
            },
            262: {
                'name': 'PhotometricInterpretation',
                'type': 'Short'
            },
            263: {
                'name': 'Threshholding',
                'type': 'Short'
            },
            264: {
                'name': 'CellWidth',
                'type': 'Short'
            },
            265: {
                'name': 'CellLength',
                'type': 'Short'
            },
            266: {
                'name': 'FillOrder',
                'type': 'Short'
            },
            269: {
                'name': 'DocumentName',
                'type': 'Ascii'
            },
            270: {
                'name': 'ImageDescription',
                'type': 'Ascii'
            },
            271: {
                'name': 'Make',
                'type': 'Ascii'
            },
            272: {
                'name': 'Model',
                'type': 'Ascii'
            },
            273: {
                'name': 'StripOffsets',
                'type': 'Long'
            },
            274: {
                'name': 'Orientation',
                'type': 'Short'
            },
            277: {
                'name': 'SamplesPerPixel',
                'type': 'Short'
            },
            278: {
                'name': 'RowsPerStrip',
                'type': 'Long'
            },
            279: {
                'name': 'StripByteCounts',
                'type': 'Long'
            },
            282: {
                'name': 'XResolution',
                'type': 'Rational'
            },
            283: {
                'name': 'YResolution',
                'type': 'Rational'
            },
            284: {
                'name': 'PlanarConfiguration',
                'type': 'Short'
            },
            290: {
                'name': 'GrayResponseUnit',
                'type': 'Short'
            },
            291: {
                'name': 'GrayResponseCurve',
                'type': 'Short'
            },
            292: {
                'name': 'T4Options',
                'type': 'Long'
            },
            293: {
                'name': 'T6Options',
                'type': 'Long'
            },
            296: {
                'name': 'ResolutionUnit',
                'type': 'Short'
            },
            301: {
                'name': 'TransferFunction',
                'type': 'Short'
            },
            305: {
                'name': 'Software',
                'type': 'Ascii'
            },
            306: {
                'name': 'DateTime',
                'type': 'Ascii'
            },
            315: {
                'name': 'Artist',
                'type': 'Ascii'
            },
            316: {
                'name': 'HostComputer',
                'type': 'Ascii'
            },
            317: {
                'name': 'Predictor',
                'type': 'Short'
            },
            318: {
                'name': 'WhitePoint',
                'type': 'Rational'
            },
            319: {
                'name': 'PrimaryChromaticities',
                'type': 'Rational'
            },
            320: {
                'name': 'ColorMap',
                'type': 'Short'
            },
            321: {
                'name': 'HalftoneHints',
                'type': 'Short'
            },
            322: {
                'name': 'TileWidth',
                'type': 'Short'
            },
            323: {
                'name': 'TileLength',
                'type': 'Short'
            },
            324: {
                'name': 'TileOffsets',
                'type': 'Short'
            },
            325: {
                'name': 'TileByteCounts',
                'type': 'Short'
            },
            330: {
                'name': 'SubIFDs',
                'type': 'Long'
            },
            332: {
                'name': 'InkSet',
                'type': 'Short'
            },
            333: {
                'name': 'InkNames',
                'type': 'Ascii'
            },
            334: {
                'name': 'NumberOfInks',
                'type': 'Short'
            },
            336: {
                'name': 'DotRange',
                'type': 'Byte'
            },
            337: {
                'name': 'TargetPrinter',
                'type': 'Ascii'
            },
            338: {
                'name': 'ExtraSamples',
                'type': 'Short'
            },
            339: {
                'name': 'SampleFormat',
                'type': 'Short'
            },
            340: {
                'name': 'SMinSampleValue',
                'type': 'Short'
            },
            341: {
                'name': 'SMaxSampleValue',
                'type': 'Short'
            },
            342: {
                'name': 'TransferRange',
                'type': 'Short'
            },
            343: {
                'name': 'ClipPath',
                'type': 'Byte'
            },
            344: {
                'name': 'XClipPathUnits',
                'type': 'Long'
            },
            345: {
                'name': 'YClipPathUnits',
                'type': 'Long'
            },
            346: {
                'name': 'Indexed',
                'type': 'Short'
            },
            347: {
                'name': 'JPEGTables',
                'type': 'Undefined'
            },
            351: {
                'name': 'OPIProxy',
                'type': 'Short'
            },
            512: {
                'name': 'JPEGProc',
                'type': 'Long'
            },
            513: {
                'name': 'JPEGInterchangeFormat',
                'type': 'Long'
            },
            514: {
                'name': 'JPEGInterchangeFormatLength',
                'type': 'Long'
            },
            515: {
                'name': 'JPEGRestartInterval',
                'type': 'Short'
            },
            517: {
                'name': 'JPEGLosslessPredictors',
                'type': 'Short'
            },
            518: {
                'name': 'JPEGPointTransforms',
                'type': 'Short'
            },
            519: {
                'name': 'JPEGQTables',
                'type': 'Long'
            },
            520: {
                'name': 'JPEGDCTables',
                'type': 'Long'
            },
            521: {
                'name': 'JPEGACTables',
                'type': 'Long'
            },
            529: {
                'name': 'YCbCrCoefficients',
                'type': 'Rational'
            },
            530: {
                'name': 'YCbCrSubSampling',
                'type': 'Short'
            },
            531: {
                'name': 'YCbCrPositioning',
                'type': 'Short'
            },
            532: {
                'name': 'ReferenceBlackWhite',
                'type': 'Rational'
            },
            700: {
                'name': 'XMLPacket',
                'type': 'Byte'
            },
            18246: {
                'name': 'Rating',
                'type': 'Short'
            },
            18249: {
                'name': 'RatingPercent',
                'type': 'Short'
            },
            32781: {
                'name': 'ImageID',
                'type': 'Ascii'
            },
            33421: {
                'name': 'CFARepeatPatternDim',
                'type': 'Short'
            },
            33422: {
                'name': 'CFAPattern',
                'type': 'Byte'
            },
            33423: {
                'name': 'BatteryLevel',
                'type': 'Rational'
            },
            33432: {
                'name': 'Copyright',
                'type': 'Ascii'
            },
            33434: {
                'name': 'ExposureTime',
                'type': 'Rational'
            },
            34377: {
                'name': 'ImageResources',
                'type': 'Byte'
            },
            34665: {
                'name': 'ExifTag',
                'type': 'Long'
            },
            34675: {
                'name': 'InterColorProfile',
                'type': 'Undefined'
            },
            34853: {
                'name': 'GPSTag',
                'type': 'Long'
            },
            34857: {
                'name': 'Interlace',
                'type': 'Short'
            },
            34858: {
                'name': 'TimeZoneOffset',
                'type': 'Long'
            },
            34859: {
                'name': 'SelfTimerMode',
                'type': 'Short'
            },
            37387: {
                'name': 'FlashEnergy',
                'type': 'Rational'
            },
            37388: {
                'name': 'SpatialFrequencyResponse',
                'type': 'Undefined'
            },
            37389: {
                'name': 'Noise',
                'type': 'Undefined'
            },
            37390: {
                'name': 'FocalPlaneXResolution',
                'type': 'Rational'
            },
            37391: {
                'name': 'FocalPlaneYResolution',
                'type': 'Rational'
            },
            37392: {
                'name': 'FocalPlaneResolutionUnit',
                'type': 'Short'
            },
            37393: {
                'name': 'ImageNumber',
                'type': 'Long'
            },
            37394: {
                'name': 'SecurityClassification',
                'type': 'Ascii'
            },
            37395: {
                'name': 'ImageHistory',
                'type': 'Ascii'
            },
            37397: {
                'name': 'ExposureIndex',
                'type': 'Rational'
            },
            37398: {
                'name': 'TIFFEPStandardID',
                'type': 'Byte'
            },
            37399: {
                'name': 'SensingMethod',
                'type': 'Short'
            },
            40091: {
                'name': 'XPTitle',
                'type': 'Byte'
            },
            40092: {
                'name': 'XPComment',
                'type': 'Byte'
            },
            40093: {
                'name': 'XPAuthor',
                'type': 'Byte'
            },
            40094: {
                'name': 'XPKeywords',
                'type': 'Byte'
            },
            40095: {
                'name': 'XPSubject',
                'type': 'Byte'
            },
            50341: {
                'name': 'PrintImageMatching',
                'type': 'Undefined'
            },
            50706: {
                'name': 'DNGVersion',
                'type': 'Byte'
            },
            50707: {
                'name': 'DNGBackwardVersion',
                'type': 'Byte'
            },
            50708: {
                'name': 'UniqueCameraModel',
                'type': 'Ascii'
            },
            50709: {
                'name': 'LocalizedCameraModel',
                'type': 'Byte'
            },
            50710: {
                'name': 'CFAPlaneColor',
                'type': 'Byte'
            },
            50711: {
                'name': 'CFALayout',
                'type': 'Short'
            },
            50712: {
                'name': 'LinearizationTable',
                'type': 'Short'
            },
            50713: {
                'name': 'BlackLevelRepeatDim',
                'type': 'Short'
            },
            50714: {
                'name': 'BlackLevel',
                'type': 'Rational'
            },
            50715: {
                'name': 'BlackLevelDeltaH',
                'type': 'SRational'
            },
            50716: {
                'name': 'BlackLevelDeltaV',
                'type': 'SRational'
            },
            50717: {
                'name': 'WhiteLevel',
                'type': 'Short'
            },
            50718: {
                'name': 'DefaultScale',
                'type': 'Rational'
            },
            50719: {
                'name': 'DefaultCropOrigin',
                'type': 'Short'
            },
            50720: {
                'name': 'DefaultCropSize',
                'type': 'Short'
            },
            50721: {
                'name': 'ColorMatrix1',
                'type': 'SRational'
            },
            50722: {
                'name': 'ColorMatrix2',
                'type': 'SRational'
            },
            50723: {
                'name': 'CameraCalibration1',
                'type': 'SRational'
            },
            50724: {
                'name': 'CameraCalibration2',
                'type': 'SRational'
            },
            50725: {
                'name': 'ReductionMatrix1',
                'type': 'SRational'
            },
            50726: {
                'name': 'ReductionMatrix2',
                'type': 'SRational'
            },
            50727: {
                'name': 'AnalogBalance',
                'type': 'Rational'
            },
            50728: {
                'name': 'AsShotNeutral',
                'type': 'Short'
            },
            50729: {
                'name': 'AsShotWhiteXY',
                'type': 'Rational'
            },
            50730: {
                'name': 'BaselineExposure',
                'type': 'SRational'
            },
            50731: {
                'name': 'BaselineNoise',
                'type': 'Rational'
            },
            50732: {
                'name': 'BaselineSharpness',
                'type': 'Rational'
            },
            50733: {
                'name': 'BayerGreenSplit',
                'type': 'Long'
            },
            50734: {
                'name': 'LinearResponseLimit',
                'type': 'Rational'
            },
            50735: {
                'name': 'CameraSerialNumber',
                'type': 'Ascii'
            },
            50736: {
                'name': 'LensInfo',
                'type': 'Rational'
            },
            50737: {
                'name': 'ChromaBlurRadius',
                'type': 'Rational'
            },
            50738: {
                'name': 'AntiAliasStrength',
                'type': 'Rational'
            },
            50739: {
                'name': 'ShadowScale',
                'type': 'SRational'
            },
            50740: {
                'name': 'DNGPrivateData',
                'type': 'Byte'
            },
            50741: {
                'name': 'MakerNoteSafety',
                'type': 'Short'
            },
            50778: {
                'name': 'CalibrationIlluminant1',
                'type': 'Short'
            },
            50779: {
                'name': 'CalibrationIlluminant2',
                'type': 'Short'
            },
            50780: {
                'name': 'BestQualityScale',
                'type': 'Rational'
            },
            50781: {
                'name': 'RawDataUniqueID',
                'type': 'Byte'
            },
            50827: {
                'name': 'OriginalRawFileName',
                'type': 'Byte'
            },
            50828: {
                'name': 'OriginalRawFileData',
                'type': 'Undefined'
            },
            50829: {
                'name': 'ActiveArea',
                'type': 'Short'
            },
            50830: {
                'name': 'MaskedAreas',
                'type': 'Short'
            },
            50831: {
                'name': 'AsShotICCProfile',
                'type': 'Undefined'
            },
            50832: {
                'name': 'AsShotPreProfileMatrix',
                'type': 'SRational'
            },
            50833: {
                'name': 'CurrentICCProfile',
                'type': 'Undefined'
            },
            50834: {
                'name': 'CurrentPreProfileMatrix',
                'type': 'SRational'
            },
            50879: {
                'name': 'ColorimetricReference',
                'type': 'Short'
            },
            50931: {
                'name': 'CameraCalibrationSignature',
                'type': 'Byte'
            },
            50932: {
                'name': 'ProfileCalibrationSignature',
                'type': 'Byte'
            },
            50934: {
                'name': 'AsShotProfileName',
                'type': 'Byte'
            },
            50935: {
                'name': 'NoiseReductionApplied',
                'type': 'Rational'
            },
            50936: {
                'name': 'ProfileName',
                'type': 'Byte'
            },
            50937: {
                'name': 'ProfileHueSatMapDims',
                'type': 'Long'
            },
            50938: {
                'name': 'ProfileHueSatMapData1',
                'type': 'Float'
            },
            50939: {
                'name': 'ProfileHueSatMapData2',
                'type': 'Float'
            },
            50940: {
                'name': 'ProfileToneCurve',
                'type': 'Float'
            },
            50941: {
                'name': 'ProfileEmbedPolicy',
                'type': 'Long'
            },
            50942: {
                'name': 'ProfileCopyright',
                'type': 'Byte'
            },
            50964: {
                'name': 'ForwardMatrix1',
                'type': 'SRational'
            },
            50965: {
                'name': 'ForwardMatrix2',
                'type': 'SRational'
            },
            50966: {
                'name': 'PreviewApplicationName',
                'type': 'Byte'
            },
            50967: {
                'name': 'PreviewApplicationVersion',
                'type': 'Byte'
            },
            50968: {
                'name': 'PreviewSettingsName',
                'type': 'Byte'
            },
            50969: {
                'name': 'PreviewSettingsDigest',
                'type': 'Byte'
            },
            50970: {
                'name': 'PreviewColorSpace',
                'type': 'Long'
            },
            50971: {
                'name': 'PreviewDateTime',
                'type': 'Ascii'
            },
            50972: {
                'name': 'RawImageDigest',
                'type': 'Undefined'
            },
            50973: {
                'name': 'OriginalRawFileDigest',
                'type': 'Undefined'
            },
            50974: {
                'name': 'SubTileBlockSize',
                'type': 'Long'
            },
            50975: {
                'name': 'RowInterleaveFactor',
                'type': 'Long'
            },
            50981: {
                'name': 'ProfileLookTableDims',
                'type': 'Long'
            },
            50982: {
                'name': 'ProfileLookTableData',
                'type': 'Float'
            },
            51008: {
                'name': 'OpcodeList1',
                'type': 'Undefined'
            },
            51009: {
                'name': 'OpcodeList2',
                'type': 'Undefined'
            },
            51022: {
                'name': 'OpcodeList3',
                'type': 'Undefined'
            }
        },
        'Exif': {
            33434: {
                'name': 'ExposureTime',
                'type': 'Rational'
            },
            33437: {
                'name': 'FNumber',
                'type': 'Rational'
            },
            34850: {
                'name': 'ExposureProgram',
                'type': 'Short'
            },
            34852: {
                'name': 'SpectralSensitivity',
                'type': 'Ascii'
            },
            34855: {
                'name': 'ISOSpeedRatings',
                'type': 'Short'
            },
            34856: {
                'name': 'OECF',
                'type': 'Undefined'
            },
            34864: {
                'name': 'SensitivityType',
                'type': 'Short'
            },
            34865: {
                'name': 'StandardOutputSensitivity',
                'type': 'Long'
            },
            34866: {
                'name': 'RecommendedExposureIndex',
                'type': 'Long'
            },
            34867: {
                'name': 'ISOSpeed',
                'type': 'Long'
            },
            34868: {
                'name': 'ISOSpeedLatitudeyyy',
                'type': 'Long'
            },
            34869: {
                'name': 'ISOSpeedLatitudezzz',
                'type': 'Long'
            },
            36864: {
                'name': 'ExifVersion',
                'type': 'Undefined'
            },
            36867: {
                'name': 'DateTimeOriginal',
                'type': 'Ascii'
            },
            36868: {
                'name': 'DateTimeDigitized',
                'type': 'Ascii'
            },
            37121: {
                'name': 'ComponentsConfiguration',
                'type': 'Undefined'
            },
            37122: {
                'name': 'CompressedBitsPerPixel',
                'type': 'Rational'
            },
            37377: {
                'name': 'ShutterSpeedValue',
                'type': 'SRational'
            },
            37378: {
                'name': 'ApertureValue',
                'type': 'Rational'
            },
            37379: {
                'name': 'BrightnessValue',
                'type': 'SRational'
            },
            37380: {
                'name': 'ExposureBiasValue',
                'type': 'SRational'
            },
            37381: {
                'name': 'MaxApertureValue',
                'type': 'Rational'
            },
            37382: {
                'name': 'SubjectDistance',
                'type': 'Rational'
            },
            37383: {
                'name': 'MeteringMode',
                'type': 'Short'
            },
            37384: {
                'name': 'LightSource',
                'type': 'Short'
            },
            37385: {
                'name': 'Flash',
                'type': 'Short'
            },
            37386: {
                'name': 'FocalLength',
                'type': 'Rational'
            },
            37396: {
                'name': 'SubjectArea',
                'type': 'Short'
            },
            37500: {
                'name': 'MakerNote',
                'type': 'Undefined'
            },
            37510: {
                'name': 'UserComment',
                'type': 'Ascii'
            },
            37520: {
                'name': 'SubSecTime',
                'type': 'Ascii'
            },
            37521: {
                'name': 'SubSecTimeOriginal',
                'type': 'Ascii'
            },
            37522: {
                'name': 'SubSecTimeDigitized',
                'type': 'Ascii'
            },
            40960: {
                'name': 'FlashpixVersion',
                'type': 'Undefined'
            },
            40961: {
                'name': 'ColorSpace',
                'type': 'Short'
            },
            40962: {
                'name': 'PixelXDimension',
                'type': 'Long'
            },
            40963: {
                'name': 'PixelYDimension',
                'type': 'Long'
            },
            40964: {
                'name': 'RelatedSoundFile',
                'type': 'Ascii'
            },
            40965: {
                'name': 'InteroperabilityTag',
                'type': 'Long'
            },
            41483: {
                'name': 'FlashEnergy',
                'type': 'Rational'
            },
            41484: {
                'name': 'SpatialFrequencyResponse',
                'type': 'Undefined'
            },
            41486: {
                'name': 'FocalPlaneXResolution',
                'type': 'Rational'
            },
            41487: {
                'name': 'FocalPlaneYResolution',
                'type': 'Rational'
            },
            41488: {
                'name': 'FocalPlaneResolutionUnit',
                'type': 'Short'
            },
            41492: {
                'name': 'SubjectLocation',
                'type': 'Short'
            },
            41493: {
                'name': 'ExposureIndex',
                'type': 'Rational'
            },
            41495: {
                'name': 'SensingMethod',
                'type': 'Short'
            },
            41728: {
                'name': 'FileSource',
                'type': 'Undefined'
            },
            41729: {
                'name': 'SceneType',
                'type': 'Undefined'
            },
            41730: {
                'name': 'CFAPattern',
                'type': 'Undefined'
            },
            41985: {
                'name': 'CustomRendered',
                'type': 'Short'
            },
            41986: {
                'name': 'ExposureMode',
                'type': 'Short'
            },
            41987: {
                'name': 'WhiteBalance',
                'type': 'Short'
            },
            41988: {
                'name': 'DigitalZoomRatio',
                'type': 'Rational'
            },
            41989: {
                'name': 'FocalLengthIn35mmFilm',
                'type': 'Short'
            },
            41990: {
                'name': 'SceneCaptureType',
                'type': 'Short'
            },
            41991: {
                'name': 'GainControl',
                'type': 'Short'
            },
            41992: {
                'name': 'Contrast',
                'type': 'Short'
            },
            41993: {
                'name': 'Saturation',
                'type': 'Short'
            },
            41994: {
                'name': 'Sharpness',
                'type': 'Short'
            },
            41995: {
                'name': 'DeviceSettingDescription',
                'type': 'Undefined'
            },
            41996: {
                'name': 'SubjectDistanceRange',
                'type': 'Short'
            },
            42016: {
                'name': 'ImageUniqueID',
                'type': 'Ascii'
            },
            42032: {
                'name': 'CameraOwnerName',
                'type': 'Ascii'
            },
            42033: {
                'name': 'BodySerialNumber',
                'type': 'Ascii'
            },
            42034: {
                'name': 'LensSpecification',
                'type': 'Rational'
            },
            42035: {
                'name': 'LensMake',
                'type': 'Ascii'
            },
            42036: {
                'name': 'LensModel',
                'type': 'Ascii'
            },
            42037: {
                'name': 'LensSerialNumber',
                'type': 'Ascii'
            },
            42240: {
                'name': 'Gamma',
                'type': 'Rational'
            }
        },
        'GPS': {
            0: {
                'name': 'GPSVersionID',
                'type': 'Byte'
            },
            1: {
                'name': 'GPSLatitudeRef',
                'type': 'Ascii'
            },
            2: {
                'name': 'GPSLatitude',
                'type': 'Rational'
            },
            3: {
                'name': 'GPSLongitudeRef',
                'type': 'Ascii'
            },
            4: {
                'name': 'GPSLongitude',
                'type': 'Rational'
            },
            5: {
                'name': 'GPSAltitudeRef',
                'type': 'Byte'
            },
            6: {
                'name': 'GPSAltitude',
                'type': 'Rational'
            },
            7: {
                'name': 'GPSTimeStamp',
                'type': 'Rational'
            },
            8: {
                'name': 'GPSSatellites',
                'type': 'Ascii'
            },
            9: {
                'name': 'GPSStatus',
                'type': 'Ascii'
            },
            10: {
                'name': 'GPSMeasureMode',
                'type': 'Ascii'
            },
            11: {
                'name': 'GPSDOP',
                'type': 'Rational'
            },
            12: {
                'name': 'GPSSpeedRef',
                'type': 'Ascii'
            },
            13: {
                'name': 'GPSSpeed',
                'type': 'Rational'
            },
            14: {
                'name': 'GPSTrackRef',
                'type': 'Ascii'
            },
            15: {
                'name': 'GPSTrack',
                'type': 'Rational'
            },
            16: {
                'name': 'GPSImgDirectionRef',
                'type': 'Ascii'
            },
            17: {
                'name': 'GPSImgDirection',
                'type': 'Rational'
            },
            18: {
                'name': 'GPSMapDatum',
                'type': 'Ascii'
            },
            19: {
                'name': 'GPSDestLatitudeRef',
                'type': 'Ascii'
            },
            20: {
                'name': 'GPSDestLatitude',
                'type': 'Rational'
            },
            21: {
                'name': 'GPSDestLongitudeRef',
                'type': 'Ascii'
            },
            22: {
                'name': 'GPSDestLongitude',
                'type': 'Rational'
            },
            23: {
                'name': 'GPSDestBearingRef',
                'type': 'Ascii'
            },
            24: {
                'name': 'GPSDestBearing',
                'type': 'Rational'
            },
            25: {
                'name': 'GPSDestDistanceRef',
                'type': 'Ascii'
            },
            26: {
                'name': 'GPSDestDistance',
                'type': 'Rational'
            },
            27: {
                'name': 'GPSProcessingMethod',
                'type': 'Undefined'
            },
            28: {
                'name': 'GPSAreaInformation',
                'type': 'Undefined'
            },
            29: {
                'name': 'GPSDateStamp',
                'type': 'Ascii'
            },
            30: {
                'name': 'GPSDifferential',
                'type': 'Short'
            },
            31: {
                'name': 'GPSHPositioningError',
                'type': 'Rational'
            }
        },
        'Interop': {
            1: {
                'name': 'InteroperabilityIndex',
                'type': 'Ascii'
            }
        },
    };
    TAGS["0th"] = TAGS["Image"];
    TAGS["1st"] = TAGS["Image"];
    that.TAGS = TAGS;

    
    that.ImageIFD = {
        ProcessingSoftware:11,
        NewSubfileType:254,
        SubfileType:255,
        ImageWidth:256,
        ImageLength:257,
        BitsPerSample:258,
        Compression:259,
        PhotometricInterpretation:262,
        Threshholding:263,
        CellWidth:264,
        CellLength:265,
        FillOrder:266,
        DocumentName:269,
        ImageDescription:270,
        Make:271,
        Model:272,
        StripOffsets:273,
        Orientation:274,
        SamplesPerPixel:277,
        RowsPerStrip:278,
        StripByteCounts:279,
        XResolution:282,
        YResolution:283,
        PlanarConfiguration:284,
        GrayResponseUnit:290,
        GrayResponseCurve:291,
        T4Options:292,
        T6Options:293,
        ResolutionUnit:296,
        TransferFunction:301,
        Software:305,
        DateTime:306,
        Artist:315,
        HostComputer:316,
        Predictor:317,
        WhitePoint:318,
        PrimaryChromaticities:319,
        ColorMap:320,
        HalftoneHints:321,
        TileWidth:322,
        TileLength:323,
        TileOffsets:324,
        TileByteCounts:325,
        SubIFDs:330,
        InkSet:332,
        InkNames:333,
        NumberOfInks:334,
        DotRange:336,
        TargetPrinter:337,
        ExtraSamples:338,
        SampleFormat:339,
        SMinSampleValue:340,
        SMaxSampleValue:341,
        TransferRange:342,
        ClipPath:343,
        XClipPathUnits:344,
        YClipPathUnits:345,
        Indexed:346,
        JPEGTables:347,
        OPIProxy:351,
        JPEGProc:512,
        JPEGInterchangeFormat:513,
        JPEGInterchangeFormatLength:514,
        JPEGRestartInterval:515,
        JPEGLosslessPredictors:517,
        JPEGPointTransforms:518,
        JPEGQTables:519,
        JPEGDCTables:520,
        JPEGACTables:521,
        YCbCrCoefficients:529,
        YCbCrSubSampling:530,
        YCbCrPositioning:531,
        ReferenceBlackWhite:532,
        XMLPacket:700,
        Rating:18246,
        RatingPercent:18249,
        ImageID:32781,
        CFARepeatPatternDim:33421,
        CFAPattern:33422,
        BatteryLevel:33423,
        Copyright:33432,
        ExposureTime:33434,
        ImageResources:34377,
        ExifTag:34665,
        InterColorProfile:34675,
        GPSTag:34853,
        Interlace:34857,
        TimeZoneOffset:34858,
        SelfTimerMode:34859,
        FlashEnergy:37387,
        SpatialFrequencyResponse:37388,
        Noise:37389,
        FocalPlaneXResolution:37390,
        FocalPlaneYResolution:37391,
        FocalPlaneResolutionUnit:37392,
        ImageNumber:37393,
        SecurityClassification:37394,
        ImageHistory:37395,
        ExposureIndex:37397,
        TIFFEPStandardID:37398,
        SensingMethod:37399,
        XPTitle:40091,
        XPComment:40092,
        XPAuthor:40093,
        XPKeywords:40094,
        XPSubject:40095,
        PrintImageMatching:50341,
        DNGVersion:50706,
        DNGBackwardVersion:50707,
        UniqueCameraModel:50708,
        LocalizedCameraModel:50709,
        CFAPlaneColor:50710,
        CFALayout:50711,
        LinearizationTable:50712,
        BlackLevelRepeatDim:50713,
        BlackLevel:50714,
        BlackLevelDeltaH:50715,
        BlackLevelDeltaV:50716,
        WhiteLevel:50717,
        DefaultScale:50718,
        DefaultCropOrigin:50719,
        DefaultCropSize:50720,
        ColorMatrix1:50721,
        ColorMatrix2:50722,
        CameraCalibration1:50723,
        CameraCalibration2:50724,
        ReductionMatrix1:50725,
        ReductionMatrix2:50726,
        AnalogBalance:50727,
        AsShotNeutral:50728,
        AsShotWhiteXY:50729,
        BaselineExposure:50730,
        BaselineNoise:50731,
        BaselineSharpness:50732,
        BayerGreenSplit:50733,
        LinearResponseLimit:50734,
        CameraSerialNumber:50735,
        LensInfo:50736,
        ChromaBlurRadius:50737,
        AntiAliasStrength:50738,
        ShadowScale:50739,
        DNGPrivateData:50740,
        MakerNoteSafety:50741,
        CalibrationIlluminant1:50778,
        CalibrationIlluminant2:50779,
        BestQualityScale:50780,
        RawDataUniqueID:50781,
        OriginalRawFileName:50827,
        OriginalRawFileData:50828,
        ActiveArea:50829,
        MaskedAreas:50830,
        AsShotICCProfile:50831,
        AsShotPreProfileMatrix:50832,
        CurrentICCProfile:50833,
        CurrentPreProfileMatrix:50834,
        ColorimetricReference:50879,
        CameraCalibrationSignature:50931,
        ProfileCalibrationSignature:50932,
        AsShotProfileName:50934,
        NoiseReductionApplied:50935,
        ProfileName:50936,
        ProfileHueSatMapDims:50937,
        ProfileHueSatMapData1:50938,
        ProfileHueSatMapData2:50939,
        ProfileToneCurve:50940,
        ProfileEmbedPolicy:50941,
        ProfileCopyright:50942,
        ForwardMatrix1:50964,
        ForwardMatrix2:50965,
        PreviewApplicationName:50966,
        PreviewApplicationVersion:50967,
        PreviewSettingsName:50968,
        PreviewSettingsDigest:50969,
        PreviewColorSpace:50970,
        PreviewDateTime:50971,
        RawImageDigest:50972,
        OriginalRawFileDigest:50973,
        SubTileBlockSize:50974,
        RowInterleaveFactor:50975,
        ProfileLookTableDims:50981,
        ProfileLookTableData:50982,
        OpcodeList1:51008,
        OpcodeList2:51009,
        OpcodeList3:51022,
        NoiseProfile:51041,
    };

    
    that.ExifIFD = {
        ExposureTime:33434,
        FNumber:33437,
        ExposureProgram:34850,
        SpectralSensitivity:34852,
        ISOSpeedRatings:34855,
        OECF:34856,
        SensitivityType:34864,
        StandardOutputSensitivity:34865,
        RecommendedExposureIndex:34866,
        ISOSpeed:34867,
        ISOSpeedLatitudeyyy:34868,
        ISOSpeedLatitudezzz:34869,
        ExifVersion:36864,
        DateTimeOriginal:36867,
        DateTimeDigitized:36868,
        ComponentsConfiguration:37121,
        CompressedBitsPerPixel:37122,
        ShutterSpeedValue:37377,
        ApertureValue:37378,
        BrightnessValue:37379,
        ExposureBiasValue:37380,
        MaxApertureValue:37381,
        SubjectDistance:37382,
        MeteringMode:37383,
        LightSource:37384,
        Flash:37385,
        FocalLength:37386,
        SubjectArea:37396,
        MakerNote:37500,
        UserComment:37510,
        SubSecTime:37520,
        SubSecTimeOriginal:37521,
        SubSecTimeDigitized:37522,
        FlashpixVersion:40960,
        ColorSpace:40961,
        PixelXDimension:40962,
        PixelYDimension:40963,
        RelatedSoundFile:40964,
        InteroperabilityTag:40965,
        FlashEnergy:41483,
        SpatialFrequencyResponse:41484,
        FocalPlaneXResolution:41486,
        FocalPlaneYResolution:41487,
        FocalPlaneResolutionUnit:41488,
        SubjectLocation:41492,
        ExposureIndex:41493,
        SensingMethod:41495,
        FileSource:41728,
        SceneType:41729,
        CFAPattern:41730,
        CustomRendered:41985,
        ExposureMode:41986,
        WhiteBalance:41987,
        DigitalZoomRatio:41988,
        FocalLengthIn35mmFilm:41989,
        SceneCaptureType:41990,
        GainControl:41991,
        Contrast:41992,
        Saturation:41993,
        Sharpness:41994,
        DeviceSettingDescription:41995,
        SubjectDistanceRange:41996,
        ImageUniqueID:42016,
        CameraOwnerName:42032,
        BodySerialNumber:42033,
        LensSpecification:42034,
        LensMake:42035,
        LensModel:42036,
        LensSerialNumber:42037,
        Gamma:42240,
    };


    that.GPSIFD = {
        GPSVersionID:0,
        GPSLatitudeRef:1,
        GPSLatitude:2,
        GPSLongitudeRef:3,
        GPSLongitude:4,
        GPSAltitudeRef:5,
        GPSAltitude:6,
        GPSTimeStamp:7,
        GPSSatellites:8,
        GPSStatus:9,
        GPSMeasureMode:10,
        GPSDOP:11,
        GPSSpeedRef:12,
        GPSSpeed:13,
        GPSTrackRef:14,
        GPSTrack:15,
        GPSImgDirectionRef:16,
        GPSImgDirection:17,
        GPSMapDatum:18,
        GPSDestLatitudeRef:19,
        GPSDestLatitude:20,
        GPSDestLongitudeRef:21,
        GPSDestLongitude:22,
        GPSDestBearingRef:23,
        GPSDestBearing:24,
        GPSDestDistanceRef:25,
        GPSDestDistance:26,
        GPSProcessingMethod:27,
        GPSAreaInformation:28,
        GPSDateStamp:29,
        GPSDifferential:30,
        GPSHPositioningError:31,
    };


    that.InteropIFD = {
        InteroperabilityIndex:1,
    };

    that.GPSHelper = {
        degToDmsRational:function (degFloat) {
            var degAbs = Math.abs(degFloat);
            var minFloat = degAbs % 1 * 60;
            var secFloat = minFloat % 1 * 60;
            var deg = Math.floor(degAbs);
            var min = Math.floor(minFloat);
            var sec = Math.round(secFloat * 100);

            return [[deg, 1], [min, 1], [sec, 100]];
        },

        dmsRationalToDeg:function (dmsArray, ref) {
            var sign = (ref === 'S' || ref === 'W') ? -1.0 : 1.0;
            var deg = dmsArray[0][0] / dmsArray[0][1] +
                      dmsArray[1][0] / dmsArray[1][1] / 60.0 +
                      dmsArray[2][0] / dmsArray[2][1] / 3600.0;

            return deg * sign;
        }
    };
    
    
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = that;
        }
        exports.piexif = that;
    } else {
        window.piexif = that;
    }

})();
