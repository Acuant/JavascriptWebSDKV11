var AcuantCameraUI = (function () {
  var player = null;

  var videoCanvas = null;
  var videoContext = null;

  let svc = {
    start: start,
    end: end,
  };

  var isStarted = false;

  var onDetectedResult = null;
  var counter = null;

  var timeout = null;

  var userOptions = {
    text: {
      NONE: "ALIGN",
      SMALL_DOCUMENT: "MOVE CLOSER",
      GOOD_DOCUMENT: null,
      CAPTURING: "CAPTURING"
    }
  };

  const TRIGGER_TIME = 2000;

  function reset() {
    onDetectedResult = null;
  }

  function end() {
    if (AcuantCamera.isCameraSupported) {
      reset();
      AcuantCamera.end();
      player.removeEventListener('play', play, 0);
    }
    isStarted = false;
  }

  function start(captureCb, errorCb, options) {
    if (options) {
      userOptions = options
    }
    if (AcuantCamera.isCameraSupported) {
      if (!isStarted) {
        isStarted = true;
        reset();
        startCamera(captureCb, errorCb);
      }
    }
    else {
      errorCb("Camera not supported.");
    }

  }

  function triggerCountDown(captureCb) {
    if (timeout === null) {
      timeout = setTimeout(function () {
        onDetectedResult.state = -1;
        capture(captureCb);
      }, TRIGGER_TIME);
    }
  }

  function cancelCountDown() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  }

  function startCamera(captureCb, errorCb) {
    AcuantCamera.start((response) => {
      if (response) {
        if (onDetectedResult && onDetectedResult.state === -1) {
          return;
        }
        else {
          if(captureCb.onFrameAvailable){
            captureCb.onFrameAvailable(response);
          }

          onDetectedResult = response;
          if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT) {
            if (timeout === null) {
              counter = new Date().getTime();
              triggerCountDown(captureCb);
              AcuantCamera.setRepeatFrameProcessor();
            }
            else {
              AcuantCamera.setRepeatFrameProcessor();
            }
          }
          else {
            cancelCountDown();
            counter = null
            AcuantCamera.setRepeatFrameProcessor();
          }
        }
      }
    }, errorCb);
    player = document.getElementById('acuant-player');
    videoCanvas = document.getElementById('acuant-video-canvas');
    videoContext = videoCanvas.getContext('2d');

    player.addEventListener('play', play, 0);
  }

  function capture(captureCb) {
    AcuantCamera.triggerCapture((response) => {
      if (response) {
        end();

        if (document.fullscreenElement) {
          document.exitFullscreen().then(() => {
            captureCb.onCaptured(response);
          })
        }
        else {
          captureCb.onCaptured(response);
        }

        AcuantCamera.crop(response.data, response.width, response.height, (result) => {
          captureCb.onCropped(result);
        });
      }
      else {
        reset();
        AcuantCamera.setRepeatFrameProcessor();
      }
    });
  }

  function play() {
    var $this = this; //cache
    (function loop() {
      if (!$this.paused && !$this.ended && isStarted) {
        videoContext.drawImage($this, 0, 0, videoCanvas.width, videoCanvas.height);
        handleUi();
        setTimeout(loop); // drawing at 60fps
      }
    })();
  }

  function drawText(text, fontWeight = 0.04, color = "#ffffff", showBackRect = true) {
    let dimension = getDimension();
    let currentOrientation = window.orientation;
    let measured = videoContext.measureText(text);

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

    videoContext.rotate(rotation * Math.PI / 180);

    if (showBackRect) {
      videoContext.fillStyle = "rgba(0, 0, 0, 0.5)";
      videoContext.fillRect(x - offsetY, y + offsetY, measured.width + offsetX, -(Math.max(dimension.width, dimension.height) * 0.05));
    }

    videoContext.font = (Math.ceil(Math.max(dimension.width, dimension.height) * fontWeight) || 0) + "px Sans-serif";
    videoContext.fillStyle = color;
    videoContext.fillText(text, x, y);
    videoContext.restore();
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
        height: Math.min(document.body.clientHeight, videoCanvas.height),
        width: Math.min(document.body.clientWidth, videoCanvas.width)
      }
    }
    else {
      return {
        height: videoCanvas.height,
        width: videoCanvas.width
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
    if (!onDetectedResult) {
      drawPoints("#000000");
      drawText(userOptions.text.NONE);
    }
    else if (onDetectedResult.state === -1) {
      drawPoints("#00ff00");
      drawOverlay("rgba(0, 255, 0, 0.2)");
      drawText(userOptions.text.CAPTURING, 0.05, "#00ff00", false);
    }
    else if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT) {
      drawPoints("#ffff00");
      drawOverlay("rgba(255, 255, 0, 0.2)");

      if (userOptions.text.GOOD_DOCUMENT) {
        let diff = Math.ceil((TRIGGER_TIME - (new Date().getTime() - counter)) / 1000)
        if (diff <= 0) {
          diff = 1;
        }
        drawText(userOptions.text.GOOD_DOCUMENT, 0.09, "#ff0000", false);
      }
      else {
        let diff = Math.ceil((TRIGGER_TIME - (new Date().getTime() - counter)) / 1000)
        if (diff <= 0) {
          diff = 1;
        }
        drawText(diff + "...", 0.09, "#ff0000", false);
      }

    }
    else if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.SMALL_DOCUMENT) {
      drawPoints("#ff0000");
      drawText(userOptions.text.SMALL_DOCUMENT);
    }
    else {
      drawPoints("#000000");
      drawText(userOptions.text.NONE);
    }
  }

  function drawOverlay(style) {
    if (onDetectedResult && onDetectedResult.points && onDetectedResult.points.length === 4) {
      videoContext.beginPath();

      videoContext.moveTo(onDetectedResult.points[0].x, onDetectedResult.points[0].y);

      for (var i = 1; i < onDetectedResult.points.length; i++) {
        videoContext.lineTo(onDetectedResult.points[i].x, onDetectedResult.points[i].y);
      }
      videoContext.fillStyle = style;
      videoContext.strokeStyle = "rgba(0, 0, 0, 0)";
      videoContext.stroke();
      videoContext.fill();
    }
  }

  function drawCorner(point, offsetX, offsetY) {
    videoContext.beginPath();
    videoContext.moveTo(point.x, point.y);
    videoContext.lineTo(point.x + offsetX, point.y)
    videoContext.stroke();
    videoContext.moveTo(point.x, point.y);
    videoContext.lineTo(point.x, point.y + offsetY);
    videoContext.stroke();
  }

  function drawPoints(fillStyle) {
    let dimension = getDimension();
    videoContext.lineWidth = (Math.ceil(Math.max(dimension.width, dimension.height) * 0.0025) || 1);
    videoContext.strokeStyle = fillStyle;
    if (onDetectedResult && onDetectedResult.points && (onDetectedResult.state === -1 || onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT)) {
      for (var i in onDetectedResult.points) {
        drawCorners(onDetectedResult.points[i], i);
      }
    }
    else {
      var center = {
        x: dimension.width / 2,
        y: dimension.height / 2
      }
      var offsetX = dimension.width * 0.4;
      var offsetY = dimension.height * 0.35;

      if(dimension.width > dimension.height){
        offsetY = dimension.height * 0.4;
        offsetX = dimension.width * 0.35;
      }

      let defaultCorners = [
        { x: center.x - offsetX, y: center.y - offsetY },
        { x: center.x + offsetX, y: center.y - offsetY },
        { x: center.x + offsetX, y: center.y + offsetY },
        { x: center.x - offsetX, y: center.y + offsetY }];

      defaultCorners.forEach((point, i) => {
        drawCorners(point, i);
      });
    }
  }

  return svc;

})();

var AcuantCamera = (function () {
    var player = null;

    var videoCanvas = null;
    var videoContext = null;
    var manualCaptureInput = null;

    const hiddenCanvas = document.createElement('canvas');
    const hiddenContext = hiddenCanvas.getContext('2d');

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

    const SMALL_DOC_DPI_SCALE = 0.25;
    const LARGE_DOC_DPI_SCALE = 0.11719;
    var onDetectCallback = null;
    var onErrorCallback = null;
    var onManualCaptureCallback = null;
    var isStarted = false;

    let svc = {
        start: start,
        startManualCapture: startManualCapture,
        triggerCapture: triggerCapture,
        end: endCamera,
        DOCUMENT_STATE: DOCUMENT_STATE,
        ACUANT_DOCUMENT_TYPE: ACUANT_DOCUMENT_TYPE,
        isCameraSupported: 'mediaDevices' in navigator && mobileCheck(),
        setRepeatFrameProcessor: setRepeatFrameProcessor,
        crop: crop
    };

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

    var userConfig = {
        targetWidth: (window.innerWidth || 950),
        targetHeight: (window.innerHeight),
        frameScale: 1,
        primaryConstraints: {
            video: {
                facingMode: { exact: "environment" },
                height: { min: 1440, ideal: 1440 },
                aspectRatio: 1.777777778
            }
        }
    };
    function enableCamera(stream){
        isStarted = true;
        player.srcObject = stream;
        addEvents();
        setRepeatFrameProcessor()
        player.play();
    }

    function callCameraError(error){
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
                onErrorCallback(error);
            })
        }
        else {
            onErrorCallback(error);
        }
    }

    function getDevice(constraints, errorCallback){
        navigator.mediaDevices.enumerateDevices()
            .then(function(devices) {
                var min = undefined;
                devices.forEach(function(device) {
                    if(device.label && device.label.indexOf("back") !== -1){
                        let split = device.label.split(',')
                        let type = parseInt(split[0][split[0].length -1]);

                        if(type || type === 0){
                            if(min === undefined || min > type){
                                min = type;
                                constraints.video.deviceId = device.deviceId;
                            }
                        }
                    }
                });
                startCamera(constraints, errorCallback);
            })
            .catch(function(err) {
                startCamera(onstraints, errorCallback);
            });
    }

    function startCamera(constraints, errorCallback) {
        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {
                if (isSafari()) {
                    enableCamera(stream);
                }
                else {
                    requestFullScreen(stream);
                }

            
            })
            .catch((error) => {
                if (typeof (errorCallback) === "function") {
                    errorCallback(error);
                }
            });
    }

    function requestFullScreen(stream) {
        videoCanvas.requestFullscreen()
            .then(function () {
                enableCamera(stream)
            })
            .catch(function (error) {
                enableCamera(stream)
            });

    }

    function start(callback, errorCallback) {
        player = document.getElementById('acuant-player');
        videoCanvas = document.getElementById('acuant-video-canvas');

        if (isStarted) {
            errorCallback("already started.");
        }
        else if (!player || !videoCanvas) {
            errorCallback("Missing HTML elements.")
        }
        else {
            videoContext = videoCanvas.getContext('2d');
            onDetectCallback = callback;
            onErrorCallback = errorCallback;

            if (!isStarted) {
                getDevice(userConfig.primaryConstraints, errorCallback);
            }
            else {
                if (typeof (errorCallback) === "function") {
                    errorCallback("already started");
                }
            }
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

    function onManualCapture(event) {        
        let file = event.target,
            reader = new FileReader();

        reader.onload = (e) => {
            let captureOrientation = getOrientation(e);
            let image = document.createElement('img');
            image.src = 'data:image/jpeg;base64,' + arrayBufferToBase64(e.target.result);
            image.onload = () => {
                let context = hiddenCanvas.getContext('2d'),
                    MAX_WIDTH = 2560,
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

                context.mozImageSmoothingEnabled = false;
                context.webkitImageSmoothingEnabled = false;
                context.msImageSmoothingEnabled = false;
                context.imageSmoothingEnabled = false;

                context.drawImage(image, 0, 0, MAX_WIDTH, MAX_HEIGHT);

                width = MAX_WIDTH;
                height = MAX_HEIGHT;

                var imgData = context.getImageData(0, 0, width, height);

                context.clearRect(0, 0, MAX_WIDTH, MAX_HEIGHT);

                AcuantJavascriptWebSdk.crop(imgData, width, height,
                    {
                        onSuccess: function (result) {
                            result.image.data = toBase64(result.image, result.cardType == 2, false, captureOrientation);
                            onManualCaptureCallback.onCropped(result);
                        },

                        onFail: function () {
                            onManualCaptureCallback.onCropped(null);
                        }
                    });
            }
        }
        
        if(file && file.files[0]){
            onManualCaptureCallback.onCaptured();
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
        if (isStarted) {
            removeEvents();
            isStarted = false;
            player.srcObject.getTracks().forEach((t) => {
                t.stop();
            });
            videoContext.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
        }
    }

    function scrollTop() {
        setTimeout(function () {
            window.scrollTo(0, 1);
        }, 250);
    }

    function onOrientationChange() {
        let onResize = function () {
            videoContext.clearRect(0, 0, videoCanvas.width, videoCanvas.height);

            if (isSafari()) {
                var scale = 0;
                if (player.videoWidth > player.videoHeight) {
                    scale = (player.videoHeight / player.videoWidth);
                }
                else {
                    scale = (player.videoWidth / player.videoHeight);
                }

                if (window.orientation === 0) {
                    let targetHeight = document.body.clientHeight;
                    videoCanvas.width = targetHeight * scale;
                    videoCanvas.height = targetHeight;
                }
                else {
                    let targetHeight = document.body.clientWidth;
                    videoCanvas.width = targetHeight;
                    videoCanvas.height = targetHeight * scale;
                }
            }
            else {
                let targetWidth = window.innerWidth;
                let targetHeight = window.innerHeight;

                if (player.videoWidth > player.videoHeight) {
                    videoCanvas.width = targetWidth;
                    videoCanvas.height = targetWidth * (player.videoHeight / player.videoWidth);
                }
                else {
                    videoCanvas.width = targetHeight * (player.videoWidth / player.videoHeight);
                    videoCanvas.height = targetHeight;
                }
            }
            scrollTop();
            window.removeEventListener('resize', onResize);
        }

        window.addEventListener('resize', onResize);
    }

    function onLoadedMetaData() {
        if (player.videoWidth + player.videoHeight < 1000) {
            endCamera();
            callCameraError("Camera not supported");
        }
        else {
            var targetWidth = window.innerWidth;
            var targetHeight = window.innerHeight;

            if (isSafari()) {
                if (player.videoWidth > player.videoHeight) {
                    targetHeight = document.body.clientWidth;

                    videoCanvas.width = targetHeight;
                    videoCanvas.height = targetHeight * (player.videoHeight / player.videoWidth);
                }
                else {
                    targetHeight = document.body.clientHeight;

                    videoCanvas.width = targetHeight * (player.videoWidth / player.videoHeight);
                    videoCanvas.height = targetHeight;
                }
            }
            else {
                if (player.videoWidth > player.videoHeight) {
                    videoCanvas.width = targetWidth;
                    videoCanvas.height = targetWidth * (player.videoHeight / player.videoWidth);
                }
                else {
                    videoCanvas.width = targetHeight * (player.videoWidth / player.videoHeight);
                    videoCanvas.height = targetHeight;
                }
            }
        }
    }

    function removeEvents() {
        window.removeEventListener("orientationchange", onOrientationChange);
        player.removeEventListener('loadedmetadata', onLoadedMetaData);
    }

    function addEvents() {
        window.addEventListener("orientationchange", onOrientationChange, false);
        player.addEventListener('loadedmetadata', onLoadedMetaData);
    }

    function setRepeatFrameProcessor() {
        if (!isStarted) {
            return;
        }

        setTimeout(function () {
            let max = Math.max(videoCanvas.width, videoCanvas.height)
            let min = Math.min(videoCanvas.width, videoCanvas.height)

            if (max > 700 && min > 500) {
                if (videoCanvas.width >= videoCanvas.height) {
                    userConfig.frameScale = (700 / videoCanvas.width)
                    hiddenCanvas.width = 700;
                    hiddenCanvas.height = videoCanvas.height * userConfig.frameScale;
                }
                else {
                    userConfig.frameScale = (700 / videoCanvas.height)
                    hiddenCanvas.width = videoCanvas.width * userConfig.frameScale;
                    hiddenCanvas.height = 700;
                }
            }
            else {
                userConfig.frameScale = 1;
                hiddenCanvas.width = videoCanvas.width;
                hiddenCanvas.height = videoCanvas.height;
            }

            hiddenContext.drawImage(player, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
            var imgData = hiddenContext.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);

            detect(imgData, hiddenCanvas.width, hiddenCanvas.height)
        }, 0);
    }

    function detect(imgData, width, height) {
        AcuantJavascriptWebSdk.detect(imgData, width, height, {
            onSuccess: function (response) {
                response.points.forEach(p => {
                    p.x = (p.x / userConfig.frameScale);
                    p.y = (p.y / userConfig.frameScale);
                });

                if (response.type === ACUANT_DOCUMENT_TYPE.NONE) {
                    response.state = DOCUMENT_STATE.NO_DOCUMENT;
                }
                else if ((Math.min(response.dimensions.width, response.dimensions.height) / Math.min(hiddenCanvas.width, hiddenCanvas.height) < 0.75 && Math.max(response.dimensions.width, response.dimensions.height) / Math.max(hiddenCanvas.width, hiddenCanvas.height) < 0.80) || !response.isCorrectAspectRatio) {
                    response.state = DOCUMENT_STATE.SMALL_DOCUMENT;
                }
                else {
                    response.state = DOCUMENT_STATE.GOOD_DOCUMENT;
                }
                onDetectCallback(response);
            },
            onFail: function () {
                let response = {}
                response.state = DOCUMENT_STATE.NO_DOCUMENT;
                onDetectCallback(response);
            }
        });
    }

    function crop(imgData, width, height, callback) {
        AcuantJavascriptWebSdk.crop(imgData, width, height, {
            onSuccess: function (response) {
                response.image.data = toBase64(response.image, response.cardType == 2, true);
                callback(response);
            },
            onFail: function () {
                callback();
            }
        });
    }

    function triggerCapture(callback) {
        hiddenCanvas.width = player.videoWidth;
        hiddenCanvas.height = player.videoHeight;
        hiddenContext.drawImage(player, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        var imgData = hiddenContext.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
        
        callback({
            data: imgData,
            width: hiddenCanvas.width,
            height:  hiddenCanvas.height
        });
    }

    function toBase64(img, isPassport, autoCapture, capturedOrientation) {
        hiddenCanvas.width = img.width;
        hiddenCanvas.height = img.height;

        let mContext = hiddenCanvas.getContext('2d');
        let mImgData = mContext.createImageData(img.width, img.height);

        setImageData(mImgData.data, img.data);
        mContext.putImageData(mImgData, 0, 0);

        if (!isPassport) {
            if (autoCapture) {
                if (window.orientation === 0) {
                    mContext.rotate(180 * Math.PI / 180);
                    mContext.drawImage(hiddenCanvas, 0, 0, -hiddenCanvas.width, -hiddenCanvas.height);
                }
            }
            else {
                if (capturedOrientation === 3) {
                    mContext.rotate(180 * Math.PI / 180);
                    mContext.drawImage(hiddenCanvas, 0, 0, -hiddenCanvas.width, -hiddenCanvas.height);
                }
            }
        }

        return hiddenCanvas.toDataURL("image/jpeg");
    }

    function setImageData(imgData, src) {
        for (let i = 0; i < imgData.length; i++) {
            imgData[i] = src[i];
        }
    }

    return svc;
})();
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
                if(isWorkerStarted && allocatedBytes === null){
                    allocatedBytes = arrayToHeap(imgData.data);
                    addClientCallback(STORED_CROP_FUNC_KEY, cb);
        
                    Module.ccall("crop", null, ["number", "number", "number", "number", "number", "number", "number"], [allocatedBytes.byteOffset, imgData.data.length, width, height, storedCallbacks[STORED_CROP_FUNC_KEY], includeSharpness, includeGlare])
                } 
                else{
                    cb.onFail();
                }
            },
            
            detect: function(imgData, width, height, cb){
                if(isWorkerStarted && allocatedDetectedBytes === null){
                    allocatedDetectedBytes = arrayToHeap(imgData.data);
                    addClientCallback(STORED_DETECT_FUNC_KEY, cb);

                    Module.ccall("detect", null, ["number", "number", "number", "number", "number"], [allocatedDetectedBytes.byteOffset, imgData.data.length, width, height, storedCallbacks[STORED_DETECT_FUNC_KEY]])
                } 
                else{
                    cb.onFail();
                }
            } 
        };
    
        const STORED_INIT_FUNC_KEY = "init";
        const STORED_CROP_FUNC_KEY = "crop";
        const STORED_DETECT_FUNC_KEY = "detect";

        const DPI_PASSPORT_SCALE_VALUE = 4.92;
        const DPI_ID_SCALE_VALUE = 3.37;
    
        var isWorkerStarted = false;
        var clientCallbacks = {};
        var storedCallbacks = {};
        var allocatedBytes = null;
        var allocatedDetectedBytes = null;

        function addInternalCallback(){
            addCallback(STORED_INIT_FUNC_KEY, onInitialize, "vi");
            addCallback(STORED_CROP_FUNC_KEY, onCrop, "viiiff");
            addCallback(STORED_DETECT_FUNC_KEY, onDetect, "viiiiiiiii");

        }
    
        function removeInternalCallback(){
            removeCallback(STORED_INIT_FUNC_KEY);
            removeCallback(STORED_CROP_FUNC_KEY);
            removeCallback(STORED_DETECT_FUNC_KEY);
        }

        function onDetect(type, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y, p4_x, p4_y){
            var cb = clientCallbacks[STORED_DETECT_FUNC_KEY];
            
            freeArray(allocatedDetectedBytes);
            allocatedDetectedBytes = null; 

            if(cb){
                if(type == -1){
                    cb.onFail()
                }
                else{
                    let dimensions = getDimensions(p1_x, p1_y, p2_x, p2_y, p3_x, p3_y, p4_x, p4_y),
                        correctAspectRatio = isCorrectAspectRatio(dimensions.width/dimensions.height, type),
                        dpi = calculateDpi(dimensions.width, dimensions.height, type == 2),
                        mappedPoints = mapPoints([{
                            x:p1_x,
                            y:p1_y
                        },
                        {
                            x:p2_x,
                            y:p2_y
                        },
                        {
                            x:p3_x,
                            y:p3_y
                        },
                        {
                            x:p4_x,
                            y:p4_y
                        }]);

                    cb.onSuccess({
                        type:type,
                        dimensions: dimensions,
                        dpi: dpi,
                        isCorrectAspectRatio: correctAspectRatio,
                        points: mappedPoints
                    })
                }
            }
        }

        function getCorners(corners, c1, c2){
            if(c1.x < c2.x && c1.y < c2.y){
                corners[0] = c1;
                corners[2] = c2;
            }
            else if(c1.x > c2.x && c1.y > c2.y){
                corners[0] = c2;
                corners[2] = c1;
            }
            else if(c1.x > c2.x && c1.y < c2.y){
                corners[1] = c1;
                corners[3] = c2;
            }
            else{
                corners[1] = c2;
                corners[3] = c1;
            }
            return corners;
        }

        function mapPoints(points){
            var mappedPoints = [-1, -1, -1, -1];
            if(points && points.length === 4){
                getCorners(mappedPoints, points[0], points[2]);
                getCorners(mappedPoints, points[1], points[3]);        
            }
            return mappedPoints;
        }

        function getDistance(p1, p2){
            return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        }

        function getDimensions(p1_x, p1_y, p2_x, p2_y, p3_x, p3_y, p4_x, p4_y){
            let p1 = {
                x: p1_x,
                y: p1_y
            },
            p2 =  {
                x: p2_x,
                y: p2_y
            },
            p3 =  {
                x: p3_x,
                y: p3_y
            },
            p4 =  {
                x: p4_x,
                y: p4_y
            },
            d1 = getDistance(p1, p2),
            d2 = getDistance(p2, p3),
            d3 = getDistance(p3, p4),
            d4 = getDistance(p4, p1);

            let avgSize1 = (d1 + d3) / 2
            let avgSize2 = (d2 + d4) / 2
            
            if(avgSize1 > avgSize2){
                return {
                    width: avgSize1, 
                    height: avgSize2
                }
            }
            else{
                return {
                    width: avgSize2, 
                    height: avgSize1
                }
            }
        }

        function isCorrectAspectRatio(aspectRatio, cardType){
            var isCorrectAspectRatio = false
            let tolerancePercentage = 5.0
            let expectedPassportAspectRatio = 1.42
            let expectedID1AspectRatio = 1.58870
            let expectedID2AspectRatio  = 1.41915551
            if(cardType == 2){
                let min = ((100-tolerancePercentage)/100)*expectedPassportAspectRatio
                let max = ((100+tolerancePercentage)/100)*expectedPassportAspectRatio
                if(aspectRatio >= min && aspectRatio <= max){
                    isCorrectAspectRatio = true
                }
            }
            else if(cardType == 1){
                let min = ((100-tolerancePercentage)/100)*expectedID1AspectRatio
                let max = ((100+tolerancePercentage)/100)*expectedID1AspectRatio
                if(aspectRatio >= min && aspectRatio <= max){
                    isCorrectAspectRatio = true
                }
            }
            return isCorrectAspectRatio
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
    
        function onCrop(width, height, cardType, rawGlare, rawSharpness){
            var cb = clientCallbacks[STORED_CROP_FUNC_KEY];

            freeArray(allocatedBytes);
            allocatedBytes = null;

            if(cb){
                if(width != -1 && height != -1 && cardType != -1){
                    let imgData = getImageData(),
                        dpi = calculateDpi(width, height, cardType == 2),
                        sharpness = rawSharpness * 100,
                        glare = rawGlare * 100;
        
                    cb.onSuccess({ 
                        image: { 
                            data: imgData,
                            width,
                            height
                        }, 
                        glare, 
                        sharpness,
                        cardType,
                        dpi
                    });
                }
                else{
                    cb.onFail();
                }
            }

            Module.ccall("release");
        }
    
        function calculateDpi(width, height, isPassport){
            let longerSide = width > height ? width : height;
            let scaleValue = isPassport ? DPI_PASSPORT_SCALE_VALUE : DPI_ID_SCALE_VALUE;
    
            return Math.round(longerSide/scaleValue);
        }

        function getImageData(){
            return Module.getBytes();
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
            input = null;
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
 
// Copyright 2010 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

var arguments_ = [];
var thisProgram = './this.program';
var quit_ = function(status, toThrow) {
  throw toThrow;
};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_HAS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
// A web environment like Electron.js can have Node enabled, so we must
// distinguish between Node-enabled environments and Node environments per se.
// This will allow the former to do things like mount NODEFS.
// Extended check using process.versions fixes issue #8816.
// (Also makes redundant the original check that 'require' is a function.)
ENVIRONMENT_HAS_NODE = typeof process === 'object' && typeof process.versions === 'object' && typeof process.versions.node === 'string';
ENVIRONMENT_IS_NODE = ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}


// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)




// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var read_,
    readAsync,
    readBinary,
    setWindowTitle;

if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';

  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  read_ = function shell_read(filename, binary) {
    var ret;
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  readBinary = function readBinary(filename) {
    var ret = read_(filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    thisProgram = process['argv'][1].replace(/\\/g, '/');
  }

  arguments_ = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  process['on']('unhandledRejection', abort);

  quit_ = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    read_ = function shell_read(f) {
      return read(f);
    };
  }

  readBinary = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    arguments_ = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    arguments_ = arguments;
  }

  if (typeof quit === 'function') {
    quit_ = function(status) {
      quit(status);
    };
  }

  if (typeof print !== 'undefined') {
    // Prefer to use print/printErr where they exist, as they usually work better.
    if (typeof console === 'undefined') console = {};
    console.log = print;
    console.warn = console.error = typeof printErr !== 'undefined' ? printErr : print;
  }
} else
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }


  read_ = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    readBinary = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
    };
  }

  readAsync = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  setWindowTitle = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
var out = Module['print'] || console.log.bind(console);
var err = Module['printErr'] || console.warn.bind(console);

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = null;

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module['arguments']) arguments_ = Module['arguments'];if (!Object.getOwnPropertyDescriptor(Module, 'arguments')) Object.defineProperty(Module, 'arguments', { get: function() { abort('Module.arguments has been replaced with plain arguments_') } });
if (Module['thisProgram']) thisProgram = Module['thisProgram'];if (!Object.getOwnPropertyDescriptor(Module, 'thisProgram')) Object.defineProperty(Module, 'thisProgram', { get: function() { abort('Module.thisProgram has been replaced with plain thisProgram') } });
if (Module['quit']) quit_ = Module['quit'];if (!Object.getOwnPropertyDescriptor(Module, 'quit')) Object.defineProperty(Module, 'quit', { get: function() { abort('Module.quit has been replaced with plain quit_') } });

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['read'] === 'undefined', 'Module.read option was removed (modify read_ in JS)');
assert(typeof Module['readAsync'] === 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
assert(typeof Module['readBinary'] === 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
assert(typeof Module['setWindowTitle'] === 'undefined', 'Module.setWindowTitle option was removed (modify setWindowTitle in JS)');
if (!Object.getOwnPropertyDescriptor(Module, 'read')) Object.defineProperty(Module, 'read', { get: function() { abort('Module.read has been replaced with plain read_') } });
if (!Object.getOwnPropertyDescriptor(Module, 'readAsync')) Object.defineProperty(Module, 'readAsync', { get: function() { abort('Module.readAsync has been replaced with plain readAsync') } });
if (!Object.getOwnPropertyDescriptor(Module, 'readBinary')) Object.defineProperty(Module, 'readBinary', { get: function() { abort('Module.readBinary has been replaced with plain readBinary') } });
// TODO: add when SDL2 is fixed if (!Object.getOwnPropertyDescriptor(Module, 'setWindowTitle')) Object.defineProperty(Module, 'setWindowTitle', { get: function() { abort('Module.setWindowTitle has been replaced with plain setWindowTitle') } });


// TODO remove when SDL2 is fixed (also see above)



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  abort('staticAlloc is no longer available at runtime; instead, perform static allocations at compile time (using makeStaticAlloc)');
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  if (end > _emscripten_get_heap_size()) {
    abort('failure to dynamicAlloc - memory growth etc. is not supported there, call malloc/sbrk directly');
  }
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  return Math.ceil(size / factor) * factor;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0, 'getNativeTypeSize invalid bits ' + bits + ', type ' + type);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(10);

// Wraps a JS function as a wasm function with a given signature.
// In the future, we may get a WebAssembly.Function constructor. Until then,
// we create a wasm module that takes the JS function as an import with a given
// signature, and re-exports that as a wasm function.
function convertJsFunctionToWasm(func, sig) {

  // The module is static, with the exception of the type section, which is
  // generated based on the signature passed in.
  var typeSection = [
    0x01, // id: section,
    0x00, // length: 0 (placeholder)
    0x01, // count: 1
    0x60, // form: func
  ];
  var sigRet = sig.slice(0, 1);
  var sigParam = sig.slice(1);
  var typeCodes = {
    'i': 0x7f, // i32
    'j': 0x7e, // i64
    'f': 0x7d, // f32
    'd': 0x7c, // f64
  };

  // Parameters, length + signatures
  typeSection.push(sigParam.length);
  for (var i = 0; i < sigParam.length; ++i) {
    typeSection.push(typeCodes[sigParam[i]]);
  }

  // Return values, length + signatures
  // With no multi-return in MVP, either 0 (void) or 1 (anything else)
  if (sigRet == 'v') {
    typeSection.push(0x00);
  } else {
    typeSection = typeSection.concat([0x01, typeCodes[sigRet]]);
  }

  // Write the overall length of the type section back into the section header
  // (excepting the 2 bytes for the section id and length)
  typeSection[1] = typeSection.length - 2;

  // Rest of the module is static
  var bytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // magic ("\0asm")
    0x01, 0x00, 0x00, 0x00, // version: 1
  ].concat(typeSection, [
    0x02, 0x07, // import section
      // (import "e" "f" (func 0 (type 0)))
      0x01, 0x01, 0x65, 0x01, 0x66, 0x00, 0x00,
    0x07, 0x05, // export section
      // (export "f" (func 0 (type 0)))
      0x01, 0x01, 0x66, 0x00, 0x00,
  ]));

   // We can compile this wasm module synchronously because it is very small.
  // This accepts an import (at "e.f"), that it reroutes to an export (at "f")
  var module = new WebAssembly.Module(bytes);
  var instance = new WebAssembly.Instance(module, {
    e: {
      f: func
    }
  });
  var wrappedFunc = instance.exports.f;
  return wrappedFunc;
}

// Add a wasm function to the table.
function addFunctionWasm(func, sig) {
  var table = wasmTable;
  var ret = table.length;

  // Grow the table
  try {
    table.grow(1);
  } catch (err) {
    if (!err instanceof RangeError) {
      throw err;
    }
    throw 'Unable to grow wasm table. Use a higher value for RESERVED_FUNCTION_POINTERS or set ALLOW_TABLE_GROWTH.';
  }

  // Insert new element
  try {
    // Attempting to call this with JS function will cause of table.set() to fail
    table.set(ret, func);
  } catch (err) {
    if (!err instanceof TypeError) {
      throw err;
    }
    assert(typeof sig !== 'undefined', 'Missing signature argument to addFunction');
    var wrapped = convertJsFunctionToWasm(func, sig);
    table.set(ret, wrapped);
  }

  return ret;
}

function removeFunctionWasm(index) {
  // TODO(sbc): Look into implementing this to allow re-using of table slots
}

// 'sig' parameter is required for the llvm backend but only when func is not
// already a WebAssembly function.
function addFunction(func, sig) {


  var base = 0;
  for (var i = base; i < base + 10; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';

}

function removeFunction(index) {

  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
};

var getTempRet0 = function() {
  return tempRet0;
};

function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;




// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html


var wasmBinary;if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];if (!Object.getOwnPropertyDescriptor(Module, 'wasmBinary')) Object.defineProperty(Module, 'wasmBinary', { get: function() { abort('Module.wasmBinary has been replaced with plain wasmBinary') } });


if (typeof WebAssembly !== 'object') {
  abort('No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.');
}


// In MINIMAL_RUNTIME, setValue() and getValue() are only available when building with safe heap enabled, for heap safety checking.
// In traditional runtime, setValue() and getValue() are always available (although their use is highly discouraged due to perf penalties)

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}





// Wasm globals

var wasmMemory;

// Potentially used for direct table calls.
var wasmTable;


//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  // For fast lookup of conversion functions
  var toC = {
    'string': function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    'array': function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };

  function convertReturnValue(ret) {
    if (returnType === 'string') return UTF8ToString(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  assert(!(opts && opts.async), 'async call is only supported with Emterpretify for now, see #9029');

  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_DYNAMIC = 2; // Cannot be freed except through sbrk
var ALLOC_NONE = 3; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc,
    stackAlloc,
    dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}




/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  abort("this function has been removed - you should use UTF8ToString(ptr, maxBytesToRead) instead!");
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAPU8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}


// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;

/**
 * @param {number} idx
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation, so that undefined means Infinity)
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var str = '';
    // If building with TextDecoder, we have already computed the string length above, so test loop end condition against that
    while (idx < endPtr) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      var u0 = u8Array[idx++];
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        if ((u0 & 0xF8) != 0xF0) warnOnce('Invalid UTF-8 leading byte 0x' + u0.toString(16) + ' encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!');
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63);
      }

      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
  return str;
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns a
// copy of that string as a Javascript String object.
// maxBytesToRead: an optional length that specifies the maximum number of bytes to read. You can omit
//                 this parameter to scan the string until the first \0 byte. If maxBytesToRead is
//                 passed, and the string at [ptr, ptr+maxBytesToReadr[ contains a null byte in the
//                 middle, then the string will cut short at that byte index (i.e. maxBytesToRead will
//                 not produce a string of exact length [ptr, ptr+maxBytesToRead[)
//                 N.B. mixing frequent uses of UTF8ToString() with and without maxBytesToRead may
//                 throw JS JIT optimizations off, so it is worth to consider consistently using one
//                 style or the other.
/**
 * @param {number} ptr
 * @param {number=} maxBytesToRead
 * @return {string}
 */
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : '';
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      if (u >= 0x200000) warnOnce('Invalid Unicode code point 0x' + u.toString(16) + ' encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).');
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) ++len;
    else if (u <= 0x7FF) len += 2;
    else if (u <= 0xFFFF) len += 3;
    else len += 4;
  }
  return len;
}


// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}




// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}


var STATIC_BASE = 1024,
    STACK_BASE = 17712,
    STACKTOP = STACK_BASE,
    STACK_MAX = 5260592,
    DYNAMIC_BASE = 5260592,
    DYNAMICTOP_PTR = 17680;

assert(STACK_BASE % 16 === 0, 'stack must start aligned');
assert(DYNAMIC_BASE % 16 === 0, 'heap must start aligned');



var TOTAL_STACK = 5242880;
if (Module['TOTAL_STACK']) assert(TOTAL_STACK === Module['TOTAL_STACK'], 'the stack size can no longer be determined at runtime')

var INITIAL_TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;if (!Object.getOwnPropertyDescriptor(Module, 'TOTAL_MEMORY')) Object.defineProperty(Module, 'TOTAL_MEMORY', { get: function() { abort('Module.TOTAL_MEMORY has been replaced with plain INITIAL_TOTAL_MEMORY') } });

assert(INITIAL_TOTAL_MEMORY >= TOTAL_STACK, 'TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + INITIAL_TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');







  if (Module['wasmMemory']) {
    wasmMemory = Module['wasmMemory'];
  } else
  {
    wasmMemory = new WebAssembly.Memory({
      'initial': INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
    });
  }


if (wasmMemory) {
  buffer = wasmMemory.buffer;
}

// If the user provides an incorrect length, just use that length instead rather than providing the user to
// specifically provide the memory length with Module['TOTAL_MEMORY'].
INITIAL_TOTAL_MEMORY = buffer.byteLength;
assert(INITIAL_TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
updateGlobalBufferViews();

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  var cookie1 = HEAPU32[(STACK_MAX >> 2)-1];
  var cookie2 = HEAPU32[(STACK_MAX >> 2)-2];
  if (cookie1 != 0x02135467 || cookie2 != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + cookie2.toString(16) + ' ' + cookie1.toString(16));
  }
  // Also test the global address 0 for integrity.
  // We don't do this with ASan because ASan does its own checks for this.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}


  HEAP32[0] = 0x63736d65; /* 'emsc' */



// Endianness check (note: assumes compiler arch was little-endian)
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function abortFnPtrError(ptr, sig) {
	abort("Invalid function pointer " + ptr + " called with signature '" + sig + "'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this). Build with ASSERTIONS=2 for more info.");
}



function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {

  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  checkStackCookie();
  assert(!runtimeInitialized);
  runtimeInitialized = true;
  
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();

  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }

  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


assert(Math.imul, 'This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.fround, 'This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.clz32, 'This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');
assert(Math.trunc, 'This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;



// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;

  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }

  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data


var memoryInitializer = null;




// show errors on likely calls to FS when it was not included
var FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




var wasmBinaryFile = 'AcuantImageProcessingService.wasm';
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary() {
  try {
    if (wasmBinary) {
      return new Uint8Array(wasmBinary);
    }

    if (readBinary) {
      return readBinary(wasmBinaryFile);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  }
  catch (err) {
    abort(err);
  }
}

function getBinaryPromise() {
  // if we don't have the binary yet, and have the Fetch api, use that
  // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
  if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
    return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
      if (!response['ok']) {
        throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
      }
      return response['arrayBuffer']();
    }).catch(function () {
      return getBinary();
    });
  }
  // Otherwise, getBinary should be able to get it synchronously
  return new Promise(function(resolve, reject) {
    resolve(getBinary());
  });
}



// Create the wasm instance.
// Receives the wasm imports, returns the exports.
function createWasm(env) {

  // prepare imports
  var info = {
    'env': env
    ,
    'global': {
      'NaN': NaN,
      'Infinity': Infinity
    },
    'global.Math': Math,
    'asm2wasm': asm2wasmImports
  };
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module['asm'] = exports;
    removeRunDependency('wasm-instantiate');
  }
   // we can't run yet (except in a pthread, where we have a custom sync instantiator)
  addRunDependency('wasm-instantiate');


  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiatedSource(output) {
    // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
      // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
      // When the regression is fixed, can restore the above USE_PTHREADS-enabled path.
    receiveInstance(output['instance']);
  }


  function instantiateArrayBuffer(receiver) {
    return getBinaryPromise().then(function(binary) {
      return WebAssembly.instantiate(binary, info);
    }).then(receiver, function(reason) {
      err('failed to asynchronously prepare wasm: ' + reason);
      abort(reason);
    });
  }

  // Prefer streaming instantiation if available.
  function instantiateAsync() {
    if (!wasmBinary &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function (response) {
        var result = WebAssembly.instantiateStreaming(response, info);
        return result.then(receiveInstantiatedSource, function(reason) {
            // We expect the most common failure cause to be a bad MIME type for the binary,
            // in which case falling back to ArrayBuffer instantiation should work.
            err('wasm streaming compile failed: ' + reason);
            err('falling back to ArrayBuffer instantiation');
            instantiateArrayBuffer(receiveInstantiatedSource);
          });
      });
    } else {
      return instantiateArrayBuffer(receiveInstantiatedSource);
    }
  }
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
  // to any other async startup actions they are performing.
  if (Module['instantiateWasm']) {
    try {
      var exports = Module['instantiateWasm'](info, receiveInstance);
      return exports;
    } catch(e) {
      err('Module.instantiateWasm callback failed with error: ' + e);
      return false;
    }
  }

  instantiateAsync();
  return {}; // no exports yet; we'll fill them in later
}

// Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
// the wasm module at that time, and it receives imports and provides exports and so forth, the app
// doesn't need to care that it is wasm or asm.js.

Module['asm'] = function(global, env, providedBuffer) {
  // memory was already allocated (so js could use the buffer)
  env['memory'] = wasmMemory
  ;
  // import table
  env['table'] = wasmTable = new WebAssembly.Table({
    'initial': 496,
    'maximum': 496,
    'element': 'anyfunc'
  });
  // With the wasm backend __memory_base and __table_base and only needed for
  // relocatable output.
  env['__memory_base'] = 1024; // tell the memory segments where to place themselves
  // table starts at 0 by default (even in dynamic linking, for the main module)
  env['__table_base'] = 0;

  var exports = createWasm(env);
  assert(exports, 'binaryen setup failed (no wasm support?)');
  return exports;
};

// Globals used by JS i64 conversions
var tempDouble;
var tempI64;

// === Body ===

var ASM_CONSTS = [];





// STATICTOP = STATIC_BASE + 16688;
/* global initializers */  __ATINIT__.push({ func: function() { globalCtors() } });








/* no memory initializer */
var tempDoublePtr = 17696
assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
}

function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];
  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];
  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];
  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];
}

// {{PRE_LIBRARY}}


  function demangle(func) {
      warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
      return func;
    }
  Module["demangle"] = demangle;

  function demangleAll(text) {
      var regex =
        /__Z[\w\d_]+/g;
      return text.replace(regex,
        function(x) {
          var y = demangle(x);
          return x === y ? x : (y + ' [' + x + ']');
        });
    }
  Module["demangleAll"] = demangleAll;

  function jsStackTrace() {
      var err = new Error();
      if (!err.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
          throw new Error(0);
        } catch(e) {
          err = e;
        }
        if (!err.stack) {
          return '(no stack trace available)';
        }
      }
      return err.stack.toString();
    }
  Module["jsStackTrace"] = jsStackTrace;

  function stackTrace() {
      var js = jsStackTrace();
      if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
      return demangleAll(js);
    }
  Module["stackTrace"] = stackTrace;

  
  var ___exception_infos={};
  Module["___exception_infos"] = ___exception_infos;
  
  var ___exception_caught= [];
  Module["___exception_caught"] = ___exception_caught;
  
  function ___exception_addRef(ptr) {
      if (!ptr) return;
      var info = ___exception_infos[ptr];
      info.refcount++;
    }
  Module["___exception_addRef"] = ___exception_addRef;
  
  function ___exception_deAdjust(adjusted) {
      if (!adjusted || ___exception_infos[adjusted]) return adjusted;
      for (var key in ___exception_infos) {
        var ptr = +key; // the iteration key is a string, and if we throw this, it must be an integer as that is what we look for
        var adj = ___exception_infos[ptr].adjusted;
        var len = adj.length;
        for (var i = 0; i < len; i++) {
          if (adj[i] === adjusted) {
            return ptr;
          }
        }
      }
      return adjusted;
    }
  Module["___exception_deAdjust"] = ___exception_deAdjust;function ___cxa_begin_catch(ptr) {
      var info = ___exception_infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exceptions--;
      }
      if (info) info.rethrown = false;
      ___exception_caught.push(ptr);
      ___exception_addRef(___exception_deAdjust(ptr));
      return ptr;
    }
  Module["___cxa_begin_catch"] = ___cxa_begin_catch;

  function ___cxa_pure_virtual() {
      ABORT = true;
  
      throw 'Pure virtual function called!';
    }
  Module["___cxa_pure_virtual"] = ___cxa_pure_virtual;

  function ___cxa_uncaught_exceptions() {
      return __ZSt18uncaught_exceptionv.uncaught_exceptions;
    }
  Module["___cxa_uncaught_exceptions"] = ___cxa_uncaught_exceptions;

  function ___gxx_personality_v0() {
    }
  Module["___gxx_personality_v0"] = ___gxx_personality_v0;

  function ___lock() {}
  Module["___lock"] = ___lock;

  
    

  
  
  var PATH={splitPath:function (filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },normalizeArray:function (parts, allowAboveRoot) {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },normalize:function (path) {
        var isAbsolute = path.charAt(0) === '/',
            trailingSlash = path.substr(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter(function(p) {
          return !!p;
        }), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },dirname:function (path) {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1);
        }
        return root + dir;
      },basename:function (path) {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/';
        var lastSlash = path.lastIndexOf('/');
        if (lastSlash === -1) return path;
        return path.substr(lastSlash+1);
      },extname:function (path) {
        return PATH.splitPath(path)[3];
      },join:function () {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join('/'));
      },join2:function (l, r) {
        return PATH.normalize(l + '/' + r);
      }};
  Module["PATH"] = PATH;var SYSCALLS={buffers:[null,[],[]],printChar:function (stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = UTF8ToString(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};
  Module["SYSCALLS"] = SYSCALLS;function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      abort('it should not be possible to operate on streams when !SYSCALLS_REQUIRE_FILESYSTEM');
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
  Module["___syscall140"] = ___syscall140;

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }
  Module["flush_NO_FILESYSTEM"] = flush_NO_FILESYSTEM;function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
  Module["___syscall146"] = ___syscall146;

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
  Module["___syscall54"] = ___syscall54;

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      abort('it should not be possible to operate on streams when !SYSCALLS_REQUIRE_FILESYSTEM');
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
  Module["___syscall6"] = ___syscall6;

  
  
   
  
   
  
  function _llvm_cttz_i32(x) { // Note: Currently doesn't take isZeroUndef()
      x = x | 0;
      return (x ? (31 - (Math_clz32((x ^ (x - 1))) | 0) | 0) : 32) | 0;
    }
  Module["_llvm_cttz_i32"] = _llvm_cttz_i32;  

  function ___unlock() {}
  Module["___unlock"] = ___unlock;

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }
  Module["getShiftFromSize"] = getShiftFromSize;
  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }
  Module["embind_init_charCodes"] = embind_init_charCodes;var embind_charCodes=undefined;
  Module["embind_charCodes"] = embind_charCodes;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  Module["readLatin1String"] = readLatin1String;
  
  
  var awaitingDependencies={};
  Module["awaitingDependencies"] = awaitingDependencies;
  
  var registeredTypes={};
  Module["registeredTypes"] = registeredTypes;
  
  var typeDependencies={};
  Module["typeDependencies"] = typeDependencies;
  
  
  
  
  
  
  var char_0=48;
  Module["char_0"] = char_0;
  
  var char_9=57;
  Module["char_9"] = char_9;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }
  Module["makeLegalFunctionName"] = makeLegalFunctionName;function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }
  Module["createNamedFunction"] = createNamedFunction;function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }
  Module["extendError"] = extendError;var BindingError=undefined;
  Module["BindingError"] = BindingError;function throwBindingError(message) {
      throw new BindingError(message);
    }
  Module["throwBindingError"] = throwBindingError;
  
  
  
  var InternalError=undefined;
  Module["InternalError"] = InternalError;function throwInternalError(message) {
      throw new InternalError(message);
    }
  Module["throwInternalError"] = throwInternalError;function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }
  Module["whenDependentTypesAreResolved"] = whenDependentTypesAreResolved;function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }
  Module["registerType"] = registerType;function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }
  Module["__embind_register_bool"] = __embind_register_bool;

  
  
  var emval_free_list=[];
  Module["emval_free_list"] = emval_free_list;
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];
  Module["emval_handle_array"] = emval_handle_array;function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }
  Module["__emval_decref"] = __emval_decref;
  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  Module["count_emval_handles"] = count_emval_handles;
  
  function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }
  Module["get_first_emval"] = get_first_emval;function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }
  Module["init_emval"] = init_emval;function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }
  Module["__emval_register"] = __emval_register;
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }
  Module["simpleReadValueFromPointer"] = simpleReadValueFromPointer;function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }
  Module["__embind_register_emval"] = __embind_register_emval;

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  Module["_embind_repr"] = _embind_repr;
  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }
  Module["floatReadValueFromPointer"] = floatReadValueFromPointer;function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }
  Module["__embind_register_float"] = __embind_register_float;

  
  
  function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
          throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
      }
  
      /*
       * Previously, the following line was just:
  
       function dummy() {};
  
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */
      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
      dummy.prototype = constructor.prototype;
      var obj = new dummy;
  
      var r = constructor.apply(obj, argumentList);
      return (r instanceof Object) ? r : obj;
    }
  Module["new_"] = new_;
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }
  Module["runDestructors"] = runDestructors;function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
  // TODO: This omits argument count check - enable only at -O3 or similar.
  //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
  //       return FUNCTION_TABLE[fn];
  //    }
  
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = false;
  
      for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
              needsDestructorStack = true;
              break;
          }
      }
  
      var returns = (argTypes[0].name !== "void");
  
      var argsList = "";
      var argsListWired = "";
      for(var i = 0; i < argCount - 2; ++i) {
          argsList += (i!==0?", ":"")+"arg"+i;
          argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
      }
  
      var invokerFnBody =
          "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
          "if (arguments.length !== "+(argCount - 2)+") {\n" +
              "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
          "}\n";
  
  
      if (needsDestructorStack) {
          invokerFnBody +=
              "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
  
  
      if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
      }
  
      for(var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
          args1.push("argType"+i);
          args2.push(argTypes[i+2]);
      }
  
      if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
  
      invokerFnBody +=
          (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";
  
      if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n";
      } else {
          for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
              var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
              if (argTypes[i].destructorFunction !== null) {
                  invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                  args1.push(paramName+"_dtor");
                  args2.push(argTypes[i].destructorFunction);
              }
          }
      }
  
      if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
                           "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
  
      args1.push(invokerFnBody);
  
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }
  Module["craftInvokerFunction"] = craftInvokerFunction;
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }
  Module["ensureOverloadTable"] = ensureOverloadTable;function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  Module["exposePublicSymbol"] = exposePublicSymbol;
  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }
  Module["heap32VectorToArray"] = heap32VectorToArray;
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          Module[name].argCount = numArguments;
      }
    }
  Module["replacePublicSymbol"] = replacePublicSymbol;
  
  function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = Module['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = Module['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  Module["embind__requireFunction"] = embind__requireFunction;
  
  
  var UnboundTypeError=undefined;
  Module["UnboundTypeError"] = UnboundTypeError;
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }
  Module["getTypeName"] = getTypeName;function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }
  Module["throwUnboundTypeError"] = throwUnboundTypeError;function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
      var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      name = readLatin1String(name);
  
      rawInvoker = embind__requireFunction(signature, rawInvoker);
  
      exposePublicSymbol(name, function() {
          throwUnboundTypeError('Cannot call ' + name + ' due to unbound types', argTypes);
      }, argCount - 1);
  
      whenDependentTypesAreResolved([], argTypes, function(argTypes) {
          var invokerArgsArray = [argTypes[0] /* return value */, null /* no class 'this'*/].concat(argTypes.slice(1) /* actual params */);
          replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null /* no class 'this'*/, rawInvoker, fn), argCount - 1);
          return [];
      });
    }
  Module["__embind_register_function"] = __embind_register_function;

  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }
  Module["integerReadValueFromPointer"] = integerReadValueFromPointer;function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
  
      var fromWireType = function(value) {
          return value;
      };
  
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      var isUnsignedType = (name.indexOf('unsigned') != -1);
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return isUnsignedType ? (value >>> 0) : (value | 0);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }
  Module["__embind_register_integer"] = __embind_register_integer;

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }
  Module["__embind_register_memory_view"] = __embind_register_memory_view;

  function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      var stdStringIsUTF8
      //process only std::string bindings with UTF8 support, in contrast to e.g. std::basic_string<unsigned char>
      = (name === "std::string");
  
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
  
              var str;
              if(stdStringIsUTF8) {
                  //ensure null termination at one-past-end byte if not present yet
                  var endChar = HEAPU8[value + 4 + length];
                  var endCharSwap = 0;
                  if(endChar != 0)
                  {
                    endCharSwap = endChar;
                    HEAPU8[value + 4 + length] = 0;
                  }
  
                  var decodeStartPtr = value + 4;
                  //looping here to support possible embedded '0' bytes
                  for (var i = 0; i <= length; ++i) {
                    var currentBytePtr = value + 4 + i;
                    if(HEAPU8[currentBytePtr] == 0)
                    {
                      var stringSegment = UTF8ToString(decodeStartPtr);
                      if(str === undefined)
                        str = stringSegment;
                      else
                      {
                        str += String.fromCharCode(0);
                        str += stringSegment;
                      }
                      decodeStartPtr = currentBytePtr + 1;
                    }
                  }
  
                  if(endCharSwap != 0)
                    HEAPU8[value + 4 + length] = endCharSwap;
              } else {
                  var a = new Array(length);
                  for (var i = 0; i < length; ++i) {
                      a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
                  }
                  str = a.join('');
              }
  
              _free(value);
              
              return str;
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
              
              var getLength;
              var valueIsOfTypeString = (typeof value === 'string');
  
              if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                  throwBindingError('Cannot pass non-string to std::string');
              }
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                  getLength = function() {return lengthBytesUTF8(value);};
              } else {
                  getLength = function() {return value.length;};
              }
              
              // assumes 4-byte alignment
              var length = getLength();
              var ptr = _malloc(4 + length + 1);
              HEAPU32[ptr >> 2] = length;
  
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                  stringToUTF8(value, ptr + 4, length + 1);
              } else {
                  if(valueIsOfTypeString) {
                      for (var i = 0; i < length; ++i) {
                          var charCode = value.charCodeAt(i);
                          if (charCode > 255) {
                              _free(ptr);
                              throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                          }
                          HEAPU8[ptr + 4 + i] = charCode;
                      }
                  } else {
                      for (var i = 0; i < length; ++i) {
                          HEAPU8[ptr + 4 + i] = value[i];
                      }
                  }
              }
  
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }
  Module["__embind_register_std_string"] = __embind_register_std_string;

  function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by emscripten_resize_heap().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var HEAP = getHeap();
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }
  Module["__embind_register_std_wstring"] = __embind_register_std_wstring;

  function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }
  Module["__embind_register_void"] = __embind_register_void;


  function __emval_incref(handle) {
      if (handle > 4) {
          emval_handle_array[handle].refcount += 1;
      }
    }
  Module["__emval_incref"] = __emval_incref;

  
  function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }
  Module["requireRegisteredType"] = requireRegisteredType;function __emval_take_value(type, argv) {
      type = requireRegisteredType(type, '_emval_take_value');
      var v = type['readValueFromPointer'](argv);
      return __emval_register(v);
    }
  Module["__emval_take_value"] = __emval_take_value;

  function _abort() {
      Module['abort']();
    }
  Module["_abort"] = _abort;

   

   

  
  
  
  function _emscripten_set_main_loop_timing(mode, value) {
      Browser.mainLoop.timingMode = mode;
      Browser.mainLoop.timingValue = value;
  
      if (!Browser.mainLoop.func) {
        console.error('emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.');
        return 1; // Return non-zero on failure, can't set timing mode when there is no main loop.
      }
  
      if (mode == 0 /*EM_TIMING_SETTIMEOUT*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now())|0;
          setTimeout(Browser.mainLoop.runner, timeUntilNextTick); // doing this each time means that on exception, we stop
        };
        Browser.mainLoop.method = 'timeout';
      } else if (mode == 1 /*EM_TIMING_RAF*/) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'rAF';
      } else if (mode == 2 /*EM_TIMING_SETIMMEDIATE*/) {
        if (typeof setImmediate === 'undefined') {
          // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
          var setImmediates = [];
          var emscriptenMainLoopMessageId = 'setimmediate';
          var Browser_setImmediate_messageHandler = function(event) {
            // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
            // so check for both cases.
            if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
              event.stopPropagation();
              setImmediates.shift()();
            }
          }
          addEventListener("message", Browser_setImmediate_messageHandler, true);
          setImmediate = function Browser_emulated_setImmediate(func) {
            setImmediates.push(func);
            if (ENVIRONMENT_IS_WORKER) {
              if (Module['setImmediates'] === undefined) Module['setImmediates'] = [];
              Module['setImmediates'].push(func);
              postMessage({target: emscriptenMainLoopMessageId}); // In --proxy-to-worker, route the message via proxyClient.js
            } else postMessage(emscriptenMainLoopMessageId, "*"); // On the main thread, can just send the message to itself.
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          setImmediate(Browser.mainLoop.runner);
        };
        Browser.mainLoop.method = 'immediate';
      }
      return 0;
    }
  Module["_emscripten_set_main_loop_timing"] = _emscripten_set_main_loop_timing;
  
  function _emscripten_get_now() { abort() }
  Module["_emscripten_get_now"] = _emscripten_get_now;function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
      Module['noExitRuntime'] = true;
  
      assert(!Browser.mainLoop.func, 'emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.');
  
      Browser.mainLoop.func = func;
      Browser.mainLoop.arg = arg;
  
      var browserIterationFunc;
      if (typeof arg !== 'undefined') {
        browserIterationFunc = function() {
          Module['dynCall_vi'](func, arg);
        };
      } else {
        browserIterationFunc = function() {
          Module['dynCall_v'](func);
        };
      }
  
      var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
  
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return;
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now();
          var blocker = Browser.mainLoop.queue.shift();
          blocker.func(blocker.arg);
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers;
            var next = remaining%1 == 0 ? remaining-1 : Math.floor(remaining);
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next;
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5; // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8*remaining + next)/9;
            }
          }
          console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + ' ms'); //, left: ' + Browser.mainLoop.remainingBlockers);
          Browser.mainLoop.updateStatus();
  
          // catches pause/resume main loop from blocker execution
          if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
          setTimeout(Browser.mainLoop.runner, 0);
          return;
        }
  
        // catch pauses from non-main loop sources
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1/*EM_TIMING_RAF*/ && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler();
          return;
        } else if (Browser.mainLoop.timingMode == 0/*EM_TIMING_SETTIMEOUT*/) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now();
        }
  
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
  
  
  
        if (Browser.mainLoop.method === 'timeout' && Module.ctx) {
          err('Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!');
          Browser.mainLoop.method = ''; // just warn once per call to set main loop
        }
  
        Browser.mainLoop.runIter(browserIterationFunc);
  
        checkStackCookie();
  
        // catch pauses from the main loop itself
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL === 'object' && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  
        Browser.mainLoop.scheduler();
      }
  
      if (!noSetTiming) {
        if (fps && fps > 0) _emscripten_set_main_loop_timing(0/*EM_TIMING_SETTIMEOUT*/, 1000.0 / fps);
        else _emscripten_set_main_loop_timing(1/*EM_TIMING_RAF*/, 1); // Do rAF by rendering each frame (no decimating)
  
        Browser.mainLoop.scheduler();
      }
  
      if (simulateInfiniteLoop) {
        throw 'SimulateInfiniteLoop';
      }
    }
  Module["_emscripten_set_main_loop"] = _emscripten_set_main_loop;var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:function () {
          Browser.mainLoop.scheduler = null;
          Browser.mainLoop.currentlyRunningMainloop++; // Incrementing this signals the previous main loop that it's now become old, and it must return.
        },resume:function () {
          Browser.mainLoop.currentlyRunningMainloop++;
          var timingMode = Browser.mainLoop.timingMode;
          var timingValue = Browser.mainLoop.timingValue;
          var func = Browser.mainLoop.func;
          Browser.mainLoop.func = null;
          _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true /* do not set timing and call scheduler, we will do it on the next lines */);
          _emscripten_set_main_loop_timing(timingMode, timingValue);
          Browser.mainLoop.scheduler();
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        },runIter:function (func) {
          if (ABORT) return;
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']();
            if (preRet === false) {
              return; // |return false| skips a frame
            }
          }
          try {
            func();
          } catch (e) {
            if (e instanceof ExitStatus) {
              return;
            } else {
              if (e && typeof e === 'object' && e.stack) err('exception thrown: ' + [e, e.stack]);
              throw e;
            }
          }
          if (Module['postMainLoop']) Module['postMainLoop']();
        }},isFullscreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
  
        if (Browser.initted) return;
        Browser.initted = true;
  
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === 'undefined') {
          console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
          Module.noImageDecoding = true;
        }
  
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
  
        var imagePlugin = {};
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
        };
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: Browser.getMimetype(name) });
              if (b.size !== byteArray.length) { // Safari bug #118630
                // Safari's Blob can only take an ArrayBuffer
                b = new Blob([(new Uint8Array(byteArray)).buffer], { type: Browser.getMimetype(name) });
              }
            } catch(e) {
              warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          assert(typeof url == 'string', 'createObjectURL must return a url as a string');
          var img = new Image();
          img.onload = function img_onload() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function img_onerror(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
  
        var audioPlugin = {};
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: Browser.getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            assert(typeof url == 'string', 'createObjectURL must return a url as a string');
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function audio_onerror(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
  
  
        // Canvas event setup
  
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === Module['canvas'] ||
                                document['mozPointerLockElement'] === Module['canvas'] ||
                                document['webkitPointerLockElement'] === Module['canvas'] ||
                                document['msPointerLockElement'] === Module['canvas'];
        }
        var canvas = Module['canvas'];
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
  
          canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                      canvas['mozRequestPointerLock'] ||
                                      canvas['webkitRequestPointerLock'] ||
                                      canvas['msRequestPointerLock'] ||
                                      function(){};
          canvas.exitPointerLock = document['exitPointerLock'] ||
                                   document['mozExitPointerLock'] ||
                                   document['webkitExitPointerLock'] ||
                                   document['msExitPointerLock'] ||
                                   function(){}; // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
  
          document.addEventListener('pointerlockchange', pointerLockChange, false);
          document.addEventListener('mozpointerlockchange', pointerLockChange, false);
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
          document.addEventListener('mspointerlockchange', pointerLockChange, false);
  
          if (Module['elementPointerLock']) {
            canvas.addEventListener("click", function(ev) {
              if (!Browser.pointerLock && Module['canvas'].requestPointerLock) {
                Module['canvas'].requestPointerLock();
                ev.preventDefault();
              }
            }, false);
          }
        }
      },createContext:function (canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx; // no need to recreate GL context if it's already been created for this canvas.
  
        var ctx;
        var contextHandle;
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false,
            majorVersion: 1,
          };
  
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute];
            }
          }
  
          // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
          // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
          // Browser.createContext() should not even be emitted.
          if (typeof GL !== 'undefined') {
            contextHandle = GL.createContext(canvas, contextAttributes);
            if (contextHandle) {
              ctx = GL.getContext(contextHandle).GLctx;
            }
          }
        } else {
          ctx = canvas.getContext('2d');
        }
  
        if (!ctx) return null;
  
        if (setInModule) {
          if (!useWebGL) assert(typeof GLctx === 'undefined', 'cannot set in module if GLctx is used, but we are a non-GL context that would replace it');
  
          Module.ctx = ctx;
          if (useWebGL) GL.makeContextCurrent(contextHandle);
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullscreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullscreen:function (lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === 'undefined') Browser.vrDevice = null;
  
        var canvas = Module['canvas'];
        function fullscreenChange() {
          Browser.isFullscreen = false;
          var canvasContainer = canvas.parentNode;
          if ((document['fullscreenElement'] || document['mozFullScreenElement'] ||
               document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
               document['webkitCurrentFullScreenElement']) === canvasContainer) {
            canvas.exitFullscreen = Browser.exitFullscreen;
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullscreen = true;
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          } else {
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
            canvasContainer.parentNode.removeChild(canvasContainer);
  
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize();
            } else {
              Browser.updateCanvasDimensions(canvas);
            }
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullscreen);
          if (Module['onFullscreen']) Module['onFullscreen'](Browser.isFullscreen);
        }
  
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullscreenChange, false);
          document.addEventListener('mozfullscreenchange', fullscreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
          document.addEventListener('MSFullscreenChange', fullscreenChange, false);
        }
  
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
  
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen = canvasContainer['requestFullscreen'] ||
                                            canvasContainer['mozRequestFullScreen'] ||
                                            canvasContainer['msRequestFullscreen'] ||
                                           (canvasContainer['webkitRequestFullscreen'] ? function() { canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null) ||
                                           (canvasContainer['webkitRequestFullScreen'] ? function() { canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
  
        if (vrDevice) {
          canvasContainer.requestFullscreen({ vrDisplay: vrDevice });
        } else {
          canvasContainer.requestFullscreen();
        }
      },requestFullScreen:function (lockPointer, resizeCanvas, vrDevice) {
          err('Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.');
          Browser.requestFullScreen = function(lockPointer, resizeCanvas, vrDevice) {
            return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
          }
          return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
      },exitFullscreen:function () {
        // This is workaround for chrome. Trying to exit from fullscreen
        // not in fullscreen state will cause "TypeError: Document not active"
        // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
        if (!Browser.isFullscreen) {
          return false;
        }
  
        var CFS = document['exitFullscreen'] ||
                  document['cancelFullScreen'] ||
                  document['mozCancelFullScreen'] ||
                  document['msExitFullscreen'] ||
                  document['webkitCancelFullScreen'] ||
            (function() {});
        CFS.apply(document, []);
        return true;
      },nextRAF:0,fakeRequestAnimationFrame:function (func) {
        // try to keep 60fps between calls to here
        var now = Date.now();
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1000/60;
        } else {
          while (now + 2 >= Browser.nextRAF) { // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1000/60;
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay);
      },requestAnimationFrame:function (func) {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(func);
          return;
        }
        var RAF = Browser.fakeRequestAnimationFrame;
        RAF(func);
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },allowAsyncCallbacks:true,queuedAsyncCallbacks:[],pauseAsyncCallbacks:function () {
        Browser.allowAsyncCallbacks = false;
      },resumeAsyncCallbacks:function () { // marks future callbacks as ok to execute, and synchronously runs any remaining ones right now
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
          var callbacks = Browser.queuedAsyncCallbacks;
          Browser.queuedAsyncCallbacks = [];
          callbacks.forEach(function(func) {
            func();
          });
        }
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        });
      },safeSetTimeout:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setTimeout(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } else {
            Browser.queuedAsyncCallbacks.push(func);
          }
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        Module['noExitRuntime'] = true;
        return setInterval(function() {
          if (ABORT) return;
          if (Browser.allowAsyncCallbacks) {
            func();
          } // drop it on the floor otherwise, next interval will kick in
        }, timeout);
      },getMimetype:function (name) {
        return {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'bmp': 'image/bmp',
          'ogg': 'audio/ogg',
          'wav': 'audio/wav',
          'mp3': 'audio/mpeg'
        }[name.substr(name.lastIndexOf('.')+1)];
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },getMouseWheelDelta:function (event) {
        var delta = 0;
        switch (event.type) {
          case 'DOMMouseScroll':
            // 3 lines make up a step
            delta = event.detail / 3;
            break;
          case 'mousewheel':
            // 120 units make up a step
            delta = event.wheelDelta / 120;
            break;
          case 'wheel':
            delta = event.deltaY
            switch(event.deltaMode) {
              case 0:
                // DOM_DELTA_PIXEL: 100 pixels make up a step
                delta /= 100;
                break;
              case 1:
                // DOM_DELTA_LINE: 3 lines make up a step
                delta /= 3;
                break;
              case 2:
                // DOM_DELTA_PAGE: A page makes up 80 steps
                delta *= 80;
                break;
              default:
                throw 'unrecognized mouse wheel delta mode: ' + event.deltaMode;
            }
            break;
          default:
            throw 'unrecognized mouse wheel event: ' + event.type;
        }
        return delta;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
  
          // check if SDL is available
          if (typeof SDL != "undefined") {
            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
          } else {
            // just add the mouse delta to the current absolut mouse position
            // FIXME: ideally this should be clamped against the canvas size and zero
            Browser.mouseX += Browser.mouseMovementX;
            Browser.mouseY += Browser.mouseMovementY;
          }
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
  
          // Neither .scrollX or .pageXOffset are defined in a spec, but
          // we prefer .scrollX because it is currently in a spec draft.
          // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
          var scrollX = ((typeof window.scrollX !== 'undefined') ? window.scrollX : window.pageXOffset);
          var scrollY = ((typeof window.scrollY !== 'undefined') ? window.scrollY : window.pageYOffset);
          // If this assert lands, it's likely because the browser doesn't support scrollX or pageXOffset
          // and we have no viable fallback.
          assert((typeof scrollX !== 'undefined') && (typeof scrollY !== 'undefined'), 'Unable to retrieve scroll position, mouse positions likely broken.');
  
          if (event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchmove') {
            var touch = event.touch;
            if (touch === undefined) {
              return; // the "touch" property is only defined in SDL
  
            }
            var adjustedX = touch.pageX - (scrollX + rect.left);
            var adjustedY = touch.pageY - (scrollY + rect.top);
  
            adjustedX = adjustedX * (cw / rect.width);
            adjustedY = adjustedY * (ch / rect.height);
  
            var coords = { x: adjustedX, y: adjustedY };
  
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords;
              Browser.touches[touch.identifier] = coords;
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier];
              if (!last) last = coords;
              Browser.lastTouches[touch.identifier] = last;
              Browser.touches[touch.identifier] = coords;
            }
            return;
          }
  
          var x = event.pageX - (scrollX + rect.left);
          var y = event.pageY - (scrollY + rect.top);
  
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
  
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        var dep = !noRunDep ? getUniqueRunDependency('al ' + url) : '';
        readAsync(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (dep) removeRunDependency(dep);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (dep) addRunDependency(dep);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullscreenCanvasSize:function () {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)]=flags
        }
        Browser.updateCanvasDimensions(Module['canvas']);
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        // check if SDL is available
        if (typeof SDL != "undefined") {
          var flags = HEAPU32[((SDL.screen)>>2)];
          flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
          HEAP32[((SDL.screen)>>2)]=flags
        }
        Browser.updateCanvasDimensions(Module['canvas']);
        Browser.updateResizeListeners();
      },updateCanvasDimensions:function (canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative;
          canvas.heightNative = hNative;
        } else {
          wNative = canvas.widthNative;
          hNative = canvas.heightNative;
        }
        var w = wNative;
        var h = hNative;
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w/h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio']);
          } else {
            h = Math.round(w / Module['forcedAspectRatio']);
          }
        }
        if (((document['fullscreenElement'] || document['mozFullScreenElement'] ||
             document['msFullscreenElement'] || document['webkitFullscreenElement'] ||
             document['webkitCurrentFullScreenElement']) === canvas.parentNode) && (typeof screen != 'undefined')) {
           var factor = Math.min(screen.width / w, screen.height / h);
           w = Math.round(w * factor);
           h = Math.round(h * factor);
        }
        if (Browser.resizeCanvas) {
          if (canvas.width  != w) canvas.width  = w;
          if (canvas.height != h) canvas.height = h;
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty( "width");
            canvas.style.removeProperty("height");
          }
        } else {
          if (canvas.width  != wNative) canvas.width  = wNative;
          if (canvas.height != hNative) canvas.height = hNative;
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty( "width", w + "px", "important");
              canvas.style.setProperty("height", h + "px", "important");
            } else {
              canvas.style.removeProperty( "width");
              canvas.style.removeProperty("height");
            }
          }
        }
      },wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:function () {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle;
      }};
  Module["Browser"] = Browser;function _emscripten_call_worker(id, funcName, data, size, callback, arg) {
      Module['noExitRuntime'] = true; // should we only do this if there is a callback?
  
      funcName = UTF8ToString(funcName);
      var info = Browser.workers[id];
      var callbackId = -1;
      if (callback) {
        callbackId = info.callbacks.length;
        info.callbacks.push({
          func: getFuncWrapper(callback, 'viii'),
          arg: arg
        });
        info.awaited++;
      }
      var transferObject = {
        'funcName': funcName,
        'callbackId': callbackId,
        'data': data ? new Uint8Array(HEAPU8.subarray((data),(data + size))) : 0
      };
      if (data) {
        info.worker.postMessage(transferObject, [transferObject.data.buffer]);
      } else {
        info.worker.postMessage(transferObject);
      }
    }
  Module["_emscripten_call_worker"] = _emscripten_call_worker;

  function _emscripten_create_worker(url) {
      url = UTF8ToString(url);
      var id = Browser.workers.length;
      var info = {
        worker: new Worker(url),
        callbacks: [],
        awaited: 0,
        buffer: 0,
        bufferSize: 0
      };
      info.worker.onmessage = function info_worker_onmessage(msg) {
        if (ABORT) return;
        var info = Browser.workers[id];
        if (!info) return; // worker was destroyed meanwhile
        var callbackId = msg.data['callbackId'];
        var callbackInfo = info.callbacks[callbackId];
        if (!callbackInfo) return; // no callback or callback removed meanwhile
        // Don't trash our callback state if we expect additional calls.
        if (msg.data['finalResponse']) {
          info.awaited--;
          info.callbacks[callbackId] = null; // TODO: reuse callbackIds, compress this
        }
        var data = msg.data['data'];
        if (data) {
          if (!data.byteLength) data = new Uint8Array(data);
          if (!info.buffer || info.bufferSize < data.length) {
            if (info.buffer) _free(info.buffer);
            info.bufferSize = data.length;
            info.buffer = _malloc(data.length);
          }
          HEAPU8.set(data, info.buffer);
          callbackInfo.func(info.buffer, data.length, callbackInfo.arg);
        } else {
          callbackInfo.func(0, 0, callbackInfo.arg);
        }
      };
      Browser.workers.push(info);
      return id;
    }
  Module["_emscripten_create_worker"] = _emscripten_create_worker;

  function _emscripten_destroy_worker(id) {
      var info = Browser.workers[id];
      info.worker.terminate();
      if (info.buffer) _free(info.buffer);
      Browser.workers[id] = null;
    }
  Module["_emscripten_destroy_worker"] = _emscripten_destroy_worker;

  function _emscripten_get_heap_size() {
      return HEAP8.length;
    }
  Module["_emscripten_get_heap_size"] = _emscripten_get_heap_size;



  function _llvm_trap() {
      abort('trap!');
    }
  Module["_llvm_trap"] = _llvm_trap;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
    }
  Module["_emscripten_memcpy_big"] = _emscripten_memcpy_big;
  
   

   

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else err('failed to set errno from JS');
      return value;
    }
  Module["___setErrNo"] = ___setErrNo;
  
  
  function abortOnCannotGrowMemory(requestedSize) {
      abort('Cannot enlarge memory arrays to size ' + requestedSize + ' bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + HEAP8.length + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
    }
  Module["abortOnCannotGrowMemory"] = abortOnCannotGrowMemory;
  
  function emscripten_realloc_buffer(size) {
      var PAGE_MULTIPLE = 65536;
      size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size
      var oldSize = buffer.byteLength;
      // native wasm support
      // note that this is *not* threadsafe. multiple threads can call .grow(), and each
      // presents a delta, so in theory we may over-allocate here (e.g. if two threads
      // ask to grow from 256MB to 512MB, we get 2 requests to add +256MB, and may end
      // up growing to 768MB (even though we may have been able to make do with 512MB).
      // TODO: consider decreasing the step sizes in emscripten_resize_heap
      try {
        var result = wasmMemory.grow((size - oldSize) / 65536); // .grow() takes a delta compared to the previous size
        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          buffer = wasmMemory.buffer;
          return true;
        } else {
          return false;
        }
      } catch(e) {
        console.error('emscripten_realloc_buffer: Attempted to grow from ' + oldSize  + ' bytes to ' + size + ' bytes, but got error: ' + e);
        return false;
      }
    }
  Module["emscripten_realloc_buffer"] = emscripten_realloc_buffer;function _emscripten_resize_heap(requestedSize) {
      var oldSize = _emscripten_get_heap_size();
      // With pthreads, races can happen (another thread might increase the size in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
  
      var PAGE_MULTIPLE = 65536;
      var LIMIT = 2147483648 - PAGE_MULTIPLE; // We can do one page short of 2GB as theoretical maximum.
  
      if (requestedSize > LIMIT) {
        err('Cannot enlarge memory, asked to go up to ' + requestedSize + ' bytes, but the limit is ' + LIMIT + ' bytes!');
        return false;
      }
  
      var MIN_TOTAL_MEMORY = 16777216;
      var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY); // So the loop below will not be infinite, and minimum asm.js memory size is 16MB.
  
      // TODO: see realloc_buffer - for PTHREADS we may want to decrease these jumps
      while (newSize < requestedSize) { // Keep incrementing the heap size as long as it's less than what is requested.
        if (newSize <= 536870912) {
          newSize = alignUp(2 * newSize, PAGE_MULTIPLE); // Simple heuristic: double until 1GB...
        } else {
          // ..., but after that, add smaller increments towards 2GB, which we cannot reach
          newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
        }
  
        if (newSize === oldSize) {
          warnOnce('Cannot ask for more memory since we reached the practical limit in browsers (which is just below 2GB), so the request would have failed. Requesting only ' + HEAP8.length);
        }
      }
  
  
  
      var start = Date.now();
  
      if (!emscripten_realloc_buffer(newSize)) {
        err('Failed to grow the heap from ' + oldSize + ' bytes to ' + newSize + ' bytes, not enough memory!');
        return false;
      }
  
      updateGlobalBufferViews();
  
  
  
      return true;
    }
  Module["_emscripten_resize_heap"] = _emscripten_resize_heap; 
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
init_emval();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) { err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead."); Module["requestFullScreen"] = Module["requestFullscreen"]; Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) { Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice) };
  Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) { Browser.requestAnimationFrame(func) };
  Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) { Browser.setCanvasSize(width, height, noUpdates) };
  Module["pauseMainLoop"] = function Module_pauseMainLoop() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function Module_resumeMainLoop() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function Module_getUserMedia() { Browser.getUserMedia() }
  Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) { return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes) };
if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function _emscripten_get_now_actual() {
      var t = process['hrtime']();
      return t[0] * 1e3 + t[1] / 1e6;
    };
  } else if (typeof dateNow !== 'undefined') {
    _emscripten_get_now = dateNow;
  } else if (typeof performance === 'object' && performance && typeof performance['now'] === 'function') {
    _emscripten_get_now = function() { return performance['now'](); };
  } else {
    _emscripten_get_now = Date.now;
  };
var ASSERTIONS = true;

// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// ASM_LIBRARY EXTERN PRIMITIVES: Math_imul,Math_clz32,Int8Array,Int32Array

function nullFunc_ii(x) { abortFnPtrError(x, 'ii'); }
function nullFunc_iidiiii(x) { abortFnPtrError(x, 'iidiiii'); }
function nullFunc_iii(x) { abortFnPtrError(x, 'iii'); }
function nullFunc_iiii(x) { abortFnPtrError(x, 'iiii'); }
function nullFunc_iiiii(x) { abortFnPtrError(x, 'iiiii'); }
function nullFunc_v(x) { abortFnPtrError(x, 'v'); }
function nullFunc_vi(x) { abortFnPtrError(x, 'vi'); }
function nullFunc_vii(x) { abortFnPtrError(x, 'vii'); }
function nullFunc_viii(x) { abortFnPtrError(x, 'viii'); }
function nullFunc_viiiff(x) { abortFnPtrError(x, 'viiiff'); }
function nullFunc_viiii(x) { abortFnPtrError(x, 'viiii'); }
function nullFunc_viiiii(x) { abortFnPtrError(x, 'viiiii'); }
function nullFunc_viiiiii(x) { abortFnPtrError(x, 'viiiiii'); }
function nullFunc_viiiiiiiii(x) { abortFnPtrError(x, 'viiiiiiiii'); }

function jsCall_ii(index,a1) {
    return functionPointers[index](a1);
}

function jsCall_iidiiii(index,a1,a2,a3,a4,a5,a6) {
    return functionPointers[index](a1,a2,a3,a4,a5,a6);
}

function jsCall_iii(index,a1,a2) {
    return functionPointers[index](a1,a2);
}

function jsCall_iiii(index,a1,a2,a3) {
    return functionPointers[index](a1,a2,a3);
}

function jsCall_iiiii(index,a1,a2,a3,a4) {
    return functionPointers[index](a1,a2,a3,a4);
}

function jsCall_v(index) {
    functionPointers[index]();
}

function jsCall_vi(index,a1) {
    functionPointers[index](a1);
}

function jsCall_vii(index,a1,a2) {
    functionPointers[index](a1,a2);
}

function jsCall_viii(index,a1,a2,a3) {
    functionPointers[index](a1,a2,a3);
}

function jsCall_viiiff(index,a1,a2,a3,a4,a5) {
    functionPointers[index](a1,a2,a3,a4,a5);
}

function jsCall_viiii(index,a1,a2,a3,a4) {
    functionPointers[index](a1,a2,a3,a4);
}

function jsCall_viiiii(index,a1,a2,a3,a4,a5) {
    functionPointers[index](a1,a2,a3,a4,a5);
}

function jsCall_viiiiii(index,a1,a2,a3,a4,a5,a6) {
    functionPointers[index](a1,a2,a3,a4,a5,a6);
}

function jsCall_viiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9) {
    functionPointers[index](a1,a2,a3,a4,a5,a6,a7,a8,a9);
}

var asmGlobalArg = {};

var asmLibraryArg = {
  "abort": abort,
  "setTempRet0": setTempRet0,
  "getTempRet0": getTempRet0,
  "abortStackOverflow": abortStackOverflow,
  "nullFunc_ii": nullFunc_ii,
  "nullFunc_iidiiii": nullFunc_iidiiii,
  "nullFunc_iii": nullFunc_iii,
  "nullFunc_iiii": nullFunc_iiii,
  "nullFunc_iiiii": nullFunc_iiiii,
  "nullFunc_v": nullFunc_v,
  "nullFunc_vi": nullFunc_vi,
  "nullFunc_vii": nullFunc_vii,
  "nullFunc_viii": nullFunc_viii,
  "nullFunc_viiiff": nullFunc_viiiff,
  "nullFunc_viiii": nullFunc_viiii,
  "nullFunc_viiiii": nullFunc_viiiii,
  "nullFunc_viiiiii": nullFunc_viiiiii,
  "nullFunc_viiiiiiiii": nullFunc_viiiiiiiii,
  "jsCall_ii": jsCall_ii,
  "jsCall_iidiiii": jsCall_iidiiii,
  "jsCall_iii": jsCall_iii,
  "jsCall_iiii": jsCall_iiii,
  "jsCall_iiiii": jsCall_iiiii,
  "jsCall_v": jsCall_v,
  "jsCall_vi": jsCall_vi,
  "jsCall_vii": jsCall_vii,
  "jsCall_viii": jsCall_viii,
  "jsCall_viiiff": jsCall_viiiff,
  "jsCall_viiii": jsCall_viiii,
  "jsCall_viiiii": jsCall_viiiii,
  "jsCall_viiiiii": jsCall_viiiiii,
  "jsCall_viiiiiiiii": jsCall_viiiiiiiii,
  "___cxa_begin_catch": ___cxa_begin_catch,
  "___cxa_pure_virtual": ___cxa_pure_virtual,
  "___cxa_uncaught_exceptions": ___cxa_uncaught_exceptions,
  "___exception_addRef": ___exception_addRef,
  "___exception_deAdjust": ___exception_deAdjust,
  "___gxx_personality_v0": ___gxx_personality_v0,
  "___lock": ___lock,
  "___setErrNo": ___setErrNo,
  "___syscall140": ___syscall140,
  "___syscall146": ___syscall146,
  "___syscall54": ___syscall54,
  "___syscall6": ___syscall6,
  "___unlock": ___unlock,
  "__embind_register_bool": __embind_register_bool,
  "__embind_register_emval": __embind_register_emval,
  "__embind_register_float": __embind_register_float,
  "__embind_register_function": __embind_register_function,
  "__embind_register_integer": __embind_register_integer,
  "__embind_register_memory_view": __embind_register_memory_view,
  "__embind_register_std_string": __embind_register_std_string,
  "__embind_register_std_wstring": __embind_register_std_wstring,
  "__embind_register_void": __embind_register_void,
  "__emval_decref": __emval_decref,
  "__emval_incref": __emval_incref,
  "__emval_register": __emval_register,
  "__emval_take_value": __emval_take_value,
  "_abort": _abort,
  "_embind_repr": _embind_repr,
  "_emscripten_call_worker": _emscripten_call_worker,
  "_emscripten_create_worker": _emscripten_create_worker,
  "_emscripten_destroy_worker": _emscripten_destroy_worker,
  "_emscripten_get_heap_size": _emscripten_get_heap_size,
  "_emscripten_get_now": _emscripten_get_now,
  "_emscripten_memcpy_big": _emscripten_memcpy_big,
  "_emscripten_resize_heap": _emscripten_resize_heap,
  "_emscripten_set_main_loop": _emscripten_set_main_loop,
  "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
  "_llvm_cttz_i32": _llvm_cttz_i32,
  "_llvm_trap": _llvm_trap,
  "abortOnCannotGrowMemory": abortOnCannotGrowMemory,
  "count_emval_handles": count_emval_handles,
  "craftInvokerFunction": craftInvokerFunction,
  "createNamedFunction": createNamedFunction,
  "demangle": demangle,
  "demangleAll": demangleAll,
  "embind__requireFunction": embind__requireFunction,
  "embind_init_charCodes": embind_init_charCodes,
  "emscripten_realloc_buffer": emscripten_realloc_buffer,
  "ensureOverloadTable": ensureOverloadTable,
  "exposePublicSymbol": exposePublicSymbol,
  "extendError": extendError,
  "floatReadValueFromPointer": floatReadValueFromPointer,
  "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM,
  "getShiftFromSize": getShiftFromSize,
  "getTypeName": getTypeName,
  "get_first_emval": get_first_emval,
  "heap32VectorToArray": heap32VectorToArray,
  "init_emval": init_emval,
  "integerReadValueFromPointer": integerReadValueFromPointer,
  "jsStackTrace": jsStackTrace,
  "makeLegalFunctionName": makeLegalFunctionName,
  "new_": new_,
  "readLatin1String": readLatin1String,
  "registerType": registerType,
  "replacePublicSymbol": replacePublicSymbol,
  "requireRegisteredType": requireRegisteredType,
  "runDestructors": runDestructors,
  "simpleReadValueFromPointer": simpleReadValueFromPointer,
  "stackTrace": stackTrace,
  "throwBindingError": throwBindingError,
  "throwInternalError": throwInternalError,
  "throwUnboundTypeError": throwUnboundTypeError,
  "whenDependentTypesAreResolved": whenDependentTypesAreResolved,
  "tempDoublePtr": tempDoublePtr,
  "DYNAMICTOP_PTR": DYNAMICTOP_PTR
};
// EMSCRIPTEN_START_ASM
var asm =Module["asm"]// EMSCRIPTEN_END_ASM
(asmGlobalArg, asmLibraryArg, buffer);

Module["asm"] = asm;
var __GLOBAL__sub_I_AcuantService_cpp = Module["__GLOBAL__sub_I_AcuantService_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_AcuantService_cpp"].apply(null, arguments)
};

var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__GLOBAL__sub_I_bind_cpp"].apply(null, arguments)
};

var __ZL28demangling_terminate_handlerv = Module["__ZL28demangling_terminate_handlerv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZL28demangling_terminate_handlerv"].apply(null, arguments)
};

var __ZL8is_equalPKSt9type_infoS1_b = Module["__ZL8is_equalPKSt9type_infoS1_b"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZL8is_equalPKSt9type_infoS1_b"].apply(null, arguments)
};

var __ZN10__cxxabiv116__shim_type_infoD2Ev = Module["__ZN10__cxxabiv116__shim_type_infoD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv116__shim_type_infoD2Ev"].apply(null, arguments)
};

var __ZN10__cxxabiv117__class_type_infoD0Ev = Module["__ZN10__cxxabiv117__class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv117__class_type_infoD0Ev"].apply(null, arguments)
};

var __ZN10__cxxabiv119__getExceptionClassEPK17_Unwind_Exception = Module["__ZN10__cxxabiv119__getExceptionClassEPK17_Unwind_Exception"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv119__getExceptionClassEPK17_Unwind_Exception"].apply(null, arguments)
};

var __ZN10__cxxabiv120__si_class_type_infoD0Ev = Module["__ZN10__cxxabiv120__si_class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv120__si_class_type_infoD0Ev"].apply(null, arguments)
};

var __ZN10__cxxabiv121__isOurExceptionClassEPK17_Unwind_Exception = Module["__ZN10__cxxabiv121__isOurExceptionClassEPK17_Unwind_Exception"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv121__isOurExceptionClassEPK17_Unwind_Exception"].apply(null, arguments)
};

var __ZN10__cxxabiv121__vmi_class_type_infoD0Ev = Module["__ZN10__cxxabiv121__vmi_class_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv121__vmi_class_type_infoD0Ev"].apply(null, arguments)
};

var __ZN10__cxxabiv123__fundamental_type_infoD0Ev = Module["__ZN10__cxxabiv123__fundamental_type_infoD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10__cxxabiv123__fundamental_type_infoD0Ev"].apply(null, arguments)
};

var __ZN10emscripten11memory_viewIhEC2EmPKh = Module["__ZN10emscripten11memory_viewIhEC2EmPKh"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten11memory_viewIhEC2EmPKh"].apply(null, arguments)
};

var __ZN10emscripten17typed_memory_viewIhEENS_11memory_viewIT_EEmPKS2_ = Module["__ZN10emscripten17typed_memory_viewIhEENS_11memory_viewIT_EEmPKS2_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten17typed_memory_viewIhEENS_11memory_viewIT_EEmPKS2_"].apply(null, arguments)
};

var __ZN10emscripten3valC2INS_11memory_viewIhEEEEOT_ = Module["__ZN10emscripten3valC2INS_11memory_viewIhEEEEOT_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten3valC2INS_11memory_viewIhEEEEOT_"].apply(null, arguments)
};

var __ZN10emscripten3valD2Ev = Module["__ZN10emscripten3valD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten3valD2Ev"].apply(null, arguments)
};

var __ZN10emscripten8functionINS_3valEJEJEEEvPKcPFT_DpT0_EDpT1_ = Module["__ZN10emscripten8functionINS_3valEJEJEEEvPKcPFT_DpT0_EDpT1_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8functionINS_3valEJEJEEEvPKcPFT_DpT0_EDpT1_"].apply(null, arguments)
};

var __ZN10emscripten8internal11BindingTypeINS_11memory_viewIhEEvE10toWireTypeERKS3_ = Module["__ZN10emscripten8internal11BindingTypeINS_11memory_viewIhEEvE10toWireTypeERKS3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11BindingTypeINS_11memory_viewIhEEvE10toWireTypeERKS3_"].apply(null, arguments)
};

var __ZN10emscripten8internal11BindingTypeINS_3valEvE10toWireTypeERKS2_ = Module["__ZN10emscripten8internal11BindingTypeINS_3valEvE10toWireTypeERKS2_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11BindingTypeINS_3valEvE10toWireTypeERKS2_"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv = Module["__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIaE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIaE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIaE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIbE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIbE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIbE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIcE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIcE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIcE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIdE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIdE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIdE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIfE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIfE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIfE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIhE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIhE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIhE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIiE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIiE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIiE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIjE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIjE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIjE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIlE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIlE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIlE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDImE3getEv = Module["__ZN10emscripten8internal11LightTypeIDImE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDImE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIsE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIsE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIsE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDItE3getEv = Module["__ZN10emscripten8internal11LightTypeIDItE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDItE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal11LightTypeIDIvE3getEv = Module["__ZN10emscripten8internal11LightTypeIDIvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal11LightTypeIDIvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal12WireTypePackIJNS_11memory_viewIhEEEEC2EOS3_ = Module["__ZN10emscripten8internal12WireTypePackIJNS_11memory_viewIhEEEEC2EOS3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal12WireTypePackIJNS_11memory_viewIhEEEEC2EOS3_"].apply(null, arguments)
};

var __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valEEEEE3getEv = Module["__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valEEEEE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valEEEEE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv = Module["__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv"].apply(null, arguments)
};

var __ZN10emscripten8internal20writeGenericWireTypeIhEEvRPNS0_15GenericWireTypeERKNS_11memory_viewIT_EE = Module["__ZN10emscripten8internal20writeGenericWireTypeIhEEvRPNS0_15GenericWireTypeERKNS_11memory_viewIT_EE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal20writeGenericWireTypeIhEEvRPNS0_15GenericWireTypeERKNS_11memory_viewIT_EE"].apply(null, arguments)
};

var __ZN10emscripten8internal21writeGenericWireTypesERPNS0_15GenericWireTypeE = Module["__ZN10emscripten8internal21writeGenericWireTypesERPNS0_15GenericWireTypeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal21writeGenericWireTypesERPNS0_15GenericWireTypeE"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewImEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewImEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewImEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_11memory_viewItEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_11memory_viewItEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_11memory_viewItEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINS_3valEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINS_3valEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINS_3valEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEvE3getEv = Module["__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIavE3getEv = Module["__ZN10emscripten8internal6TypeIDIavE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIavE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIbvE3getEv = Module["__ZN10emscripten8internal6TypeIDIbvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIbvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIcvE3getEv = Module["__ZN10emscripten8internal6TypeIDIcvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIcvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIdvE3getEv = Module["__ZN10emscripten8internal6TypeIDIdvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIdvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIfvE3getEv = Module["__ZN10emscripten8internal6TypeIDIfvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIfvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIhvE3getEv = Module["__ZN10emscripten8internal6TypeIDIhvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIhvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIivE3getEv = Module["__ZN10emscripten8internal6TypeIDIivE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIivE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIjvE3getEv = Module["__ZN10emscripten8internal6TypeIDIjvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIjvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIlvE3getEv = Module["__ZN10emscripten8internal6TypeIDIlvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIlvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDImvE3getEv = Module["__ZN10emscripten8internal6TypeIDImvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDImvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIsvE3getEv = Module["__ZN10emscripten8internal6TypeIDIsvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIsvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDItvE3getEv = Module["__ZN10emscripten8internal6TypeIDItvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDItvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal6TypeIDIvvE3getEv = Module["__ZN10emscripten8internal6TypeIDIvvE3getEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal6TypeIDIvvE3getEv"].apply(null, arguments)
};

var __ZN10emscripten8internal7InvokerINS_3valEJEE6invokeEPFS2_vE = Module["__ZN10emscripten8internal7InvokerINS_3valEJEE6invokeEPFS2_vE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN10emscripten8internal7InvokerINS_3valEJEE6invokeEPFS2_vE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_110StringViewC2EPKc = Module["__ZN12_GLOBAL__N_110StringViewC2EPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_110StringViewC2EPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_110StringViewC2EPKcS2_ = Module["__ZN12_GLOBAL__N_110StringViewC2EPKcS2_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_110StringViewC2EPKcS2_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_110StringViewC2Ev = Module["__ZN12_GLOBAL__N_110StringViewC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_110StringViewC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_112OutputStream18setCurrentPositionEm = Module["__ZN12_GLOBAL__N_112OutputStream18setCurrentPositionEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_112OutputStream18setCurrentPositionEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_112OutputStream4growEm = Module["__ZN12_GLOBAL__N_112OutputStream4growEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_112OutputStream4growEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_112OutputStream5resetEPcm = Module["__ZN12_GLOBAL__N_112OutputStream5resetEPcm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_112OutputStream5resetEPcm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_112OutputStream9getBufferEv = Module["__ZN12_GLOBAL__N_112OutputStream9getBufferEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_112OutputStream9getBufferEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_112OutputStreamC2Ev = Module["__ZN12_GLOBAL__N_112OutputStreamC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_112OutputStreamC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_112OutputStreampLENS_10StringViewE = Module["__ZN12_GLOBAL__N_112OutputStreampLENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_112OutputStreampLENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_112OutputStreampLEc = Module["__ZN12_GLOBAL__N_112OutputStreampLEc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_112OutputStreampLEc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_114SwapAndRestoreIPKcEC2ERS2_S2_ = Module["__ZN12_GLOBAL__N_114SwapAndRestoreIPKcEC2ERS2_S2_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_114SwapAndRestoreIPKcEC2ERS2_S2_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_114SwapAndRestoreIPKcED2Ev = Module["__ZN12_GLOBAL__N_114SwapAndRestoreIPKcED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_114SwapAndRestoreIPKcED2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_114SwapAndRestoreIbEC2ERbb = Module["__ZN12_GLOBAL__N_114SwapAndRestoreIbEC2ERbb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_114SwapAndRestoreIbEC2ERbb"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_114SwapAndRestoreIbED2Ev = Module["__ZN12_GLOBAL__N_114SwapAndRestoreIbED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_114SwapAndRestoreIbED2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_114SwapAndRestoreIjEC2ERjj = Module["__ZN12_GLOBAL__N_114SwapAndRestoreIjEC2ERjj"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_114SwapAndRestoreIjEC2ERjj"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_114SwapAndRestoreIjED2Ev = Module["__ZN12_GLOBAL__N_114SwapAndRestoreIjED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_114SwapAndRestoreIjED2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_114register_floatIdEEvPKc = Module["__ZN12_GLOBAL__N_114register_floatIdEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_114register_floatIdEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_114register_floatIfEEvPKc = Module["__ZN12_GLOBAL__N_114register_floatIfEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_114register_floatIfEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator17allocateNodeArrayEm = Module["__ZN12_GLOBAL__N_116DefaultAllocator17allocateNodeArrayEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator17allocateNodeArrayEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10AbiTagAttrEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10AbiTagAttrEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10AbiTagAttrEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10BinaryExprEJRPNS2_4NodeERNS_10StringViewES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10BinaryExprEJRPNS2_4NodeERNS_10StringViewES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10BinaryExprEJRPNS2_4NodeERNS_10StringViewES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10BracedExprEJRPNS2_4NodeES6_bEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10BracedExprEJRPNS2_4NodeES6_bEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10BracedExprEJRPNS2_4NodeES6_bEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10DeleteExprEJRPNS2_4NodeERbbEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10DeleteExprEJRPNS2_4NodeERbbEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10DeleteExprEJRPNS2_4NodeERbbEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10MemberExprEJRPNS2_4NodeERA2_KcS6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10MemberExprEJRPNS2_4NodeERA2_KcS6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10MemberExprEJRPNS2_4NodeERA2_KcS6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10MemberExprEJRPNS2_4NodeERA3_KcS6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10MemberExprEJRPNS2_4NodeERA3_KcS6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10MemberExprEJRPNS2_4NodeERA3_KcS6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10NestedNameEJRPNS2_4NodeES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10NestedNameEJRPNS2_4NodeES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10NestedNameEJRPNS2_4NodeES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10PrefixExprEJRNS_10StringViewERPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10PrefixExprEJRNS_10StringViewERPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10PrefixExprEJRNS_10StringViewERPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeENS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeENS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeENS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle10VectorTypeEJRPNS2_4NodeES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11PointerTypeEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11PointerTypeEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11PointerTypeEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11PostfixExprEJRPNS2_4NodeERA3_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11PostfixExprEJRPNS2_4NodeERA3_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11PostfixExprEJRPNS2_4NodeERA3_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA12_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA12_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA12_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA14_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA14_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA14_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA18_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA18_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA18_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA19_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA19_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA19_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA20_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA20_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA20_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA22_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA22_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA22_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA25_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA25_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA25_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA27_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA27_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA27_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA34_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA34_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA34_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA41_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA41_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA41_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA9_KcRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA9_KcRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle11SpecialNameEJRA9_KcRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12CtorDtorNameEJRPNS2_4NodeEbRiEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12CtorDtorNameEJRPNS2_4NodeEbRiEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12CtorDtorNameEJRPNS2_4NodeEbRiEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12EnableIfAttrEJNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12EnableIfAttrEJNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12EnableIfAttrEJNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12FunctionTypeEJRPNS2_4NodeERNS2_9NodeArrayERNS2_10QualifiersERNS2_15FunctionRefQualES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12FunctionTypeEJRPNS2_4NodeERNS2_9NodeArrayERNS2_10QualifiersERNS2_15FunctionRefQualES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12FunctionTypeEJRPNS2_4NodeERNS2_9NodeArrayERNS2_10QualifiersERNS2_15FunctionRefQualES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12InitListExprEJDnNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12InitListExprEJDnNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12InitListExprEJDnNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12InitListExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12InitListExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12InitListExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12NoexceptSpecEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12NoexceptSpecEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12NoexceptSpecEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12TemplateArgsEJNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12TemplateArgsEJNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle12TemplateArgsEJNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA10_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA10_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA10_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA11_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA11_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA11_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA12_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA12_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA12_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA9_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA9_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13EnclosingExprEJRA9_KcRPNS2_4NodeERA2_S4_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13FunctionParamEJRNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13FunctionParamEJRNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13FunctionParamEJRNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13NodeArrayNodeEJNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13NodeArrayNodeEJNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13NodeArrayNodeEJNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ObjCProtoNameEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ObjCProtoNameEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ObjCProtoNameEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ParameterPackEJNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ParameterPackEJNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ParameterPackEJNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13QualifiedNameEJRPNS2_4NodeES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13QualifiedNameEJRPNS2_4NodeES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13QualifiedNameEJRPNS2_4NodeES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ReferenceTypeEJRPNS2_4NodeENS2_13ReferenceKindEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ReferenceTypeEJRPNS2_4NodeENS2_13ReferenceKindEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle13ReferenceTypeEJRPNS2_4NodeENS2_13ReferenceKindEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14ConversionExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14ConversionExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14ConversionExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14ConversionExprEJRPNS2_4NodeERNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14ConversionExprEJRPNS2_4NodeERNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14ConversionExprEJRPNS2_4NodeERNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14IntegerLiteralEJRNS_10StringViewES5_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14IntegerLiteralEJRNS_10StringViewES5_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle14IntegerLiteralEJRNS_10StringViewES5_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15BracedRangeExprEJRPNS2_4NodeES6_S6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15BracedRangeExprEJRPNS2_4NodeES6_S6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15BracedRangeExprEJRPNS2_4NodeES6_S6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15ClosureTypeNameEJRNS2_9NodeArrayERNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15ClosureTypeNameEJRNS2_9NodeArrayERNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15ClosureTypeNameEJRNS2_9NodeArrayERNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15ConditionalExprEJRPNS2_4NodeES6_S6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15ConditionalExprEJRPNS2_4NodeES6_S6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15ConditionalExprEJRPNS2_4NodeES6_S6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15IntegerCastExprEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15IntegerCastExprEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15IntegerCastExprEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15LiteralOperatorEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15LiteralOperatorEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15LiteralOperatorEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15PixelVectorTypeEJRNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15PixelVectorTypeEJRNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15PixelVectorTypeEJRNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15UnnamedTypeNameEJRNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15UnnamedTypeNameEJRNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle15UnnamedTypeNameEJRNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIdEEJRNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIdEEJRNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIdEEJRNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIeEEJRNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIeEEJRNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIeEEJRNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIfEEJRNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIfEEJRNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FloatLiteralImplIfEEJRNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FunctionEncodingEJRPNS2_4NodeES6_NS2_9NodeArrayES6_RNS2_10QualifiersERNS2_15FunctionRefQualEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FunctionEncodingEJRPNS2_4NodeES6_NS2_9NodeArrayES6_RNS2_10QualifiersERNS2_15FunctionRefQualEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16FunctionEncodingEJRPNS2_4NodeES6_NS2_9NodeArrayES6_RNS2_10QualifiersERNS2_15FunctionRefQualEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16StdQualifiedNameEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16StdQualifiedNameEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle16StdQualifiedNameEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle17VendorExtQualTypeEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle17VendorExtQualTypeEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle17VendorExtQualTypeEJRPNS2_4NodeERNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle18ArraySubscriptExprEJRPNS2_4NodeES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle18ArraySubscriptExprEJRPNS2_4NodeES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle18ArraySubscriptExprEJRPNS2_4NodeES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19GlobalQualifiedNameEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19GlobalQualifiedNameEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19GlobalQualifiedNameEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19PointerToMemberTypeEJRPNS2_4NodeES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19PointerToMemberTypeEJRPNS2_4NodeES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19PointerToMemberTypeEJRPNS2_4NodeES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19SizeofParamPackExprEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19SizeofParamPackExprEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19SizeofParamPackExprEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19SpecialSubstitutionEJNS2_14SpecialSubKindEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19SpecialSubstitutionEJNS2_14SpecialSubKindEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle19SpecialSubstitutionEJNS2_14SpecialSubKindEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20DynamicExceptionSpecEJNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20DynamicExceptionSpecEJNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20DynamicExceptionSpecEJNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20NameWithTemplateArgsEJRPNS2_4NodeES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20NameWithTemplateArgsEJRPNS2_4NodeES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20NameWithTemplateArgsEJRPNS2_4NodeES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20PostfixQualifiedTypeEJRPNS2_4NodeERA11_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20PostfixQualifiedTypeEJRPNS2_4NodeERA11_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20PostfixQualifiedTypeEJRPNS2_4NodeERA11_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20PostfixQualifiedTypeEJRPNS2_4NodeERA9_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20PostfixQualifiedTypeEJRPNS2_4NodeERA9_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20PostfixQualifiedTypeEJRPNS2_4NodeERA9_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20TemplateArgumentPackEJRNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20TemplateArgumentPackEJRNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle20TemplateArgumentPackEJRNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle21CtorVtableSpecialNameEJRPNS2_4NodeES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle21CtorVtableSpecialNameEJRPNS2_4NodeES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle21CtorVtableSpecialNameEJRPNS2_4NodeES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle21StructuredBindingNameEJNS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle21StructuredBindingNameEJNS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle21StructuredBindingNameEJNS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ConversionOperatorTypeEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ConversionOperatorTypeEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ConversionOperatorTypeEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ElaboratedTypeSpefTypeEJRNS_10StringViewERPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ElaboratedTypeSpefTypeEJRNS_10StringViewERPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ElaboratedTypeSpefTypeEJRNS_10StringViewERPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ParameterPackExpansionEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ParameterPackExpansionEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle22ParameterPackExpansionEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle24ForwardTemplateReferenceEJRmEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle24ForwardTemplateReferenceEJRmEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle24ForwardTemplateReferenceEJRmEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle27ExpandedSpecialSubstitutionEJRNS2_14SpecialSubKindEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle27ExpandedSpecialSubstitutionEJRNS2_14SpecialSubKindEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle27ExpandedSpecialSubstitutionEJRNS2_14SpecialSubKindEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle7NewExprEJRNS2_9NodeArrayERPNS2_4NodeES4_RbS9_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle7NewExprEJRNS2_9NodeArrayERPNS2_4NodeES4_RbS9_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle7NewExprEJRNS2_9NodeArrayERPNS2_4NodeES4_RbS9_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle7NewExprEJRNS2_9NodeArrayERPNS2_4NodeES5_RbS9_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle7NewExprEJRNS2_9NodeArrayERPNS2_4NodeES5_RbS9_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle7NewExprEJRNS2_9NodeArrayERPNS2_4NodeES5_RbS9_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8BoolExprEJiEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8BoolExprEJiEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8BoolExprEJiEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CallExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CallExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CallExprEJRPNS2_4NodeENS2_9NodeArrayEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA11_KcRPNS2_4NodeES9_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA11_KcRPNS2_4NodeES9_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA11_KcRPNS2_4NodeES9_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA12_KcRPNS2_4NodeES9_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA12_KcRPNS2_4NodeES9_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA12_KcRPNS2_4NodeES9_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA13_KcRPNS2_4NodeES9_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA13_KcRPNS2_4NodeES9_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA13_KcRPNS2_4NodeES9_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA17_KcRPNS2_4NodeES9_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA17_KcRPNS2_4NodeES9_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8CastExprEJRA17_KcRPNS2_4NodeES9_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8DtorNameEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8DtorNameEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8DtorNameEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8FoldExprEJRbRNS_10StringViewERPNS2_4NodeES9_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8FoldExprEJRbRNS_10StringViewERPNS2_4NodeES9_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8FoldExprEJRbRNS_10StringViewERPNS2_4NodeES9_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA10_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA10_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA10_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA11_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA11_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA11_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA12_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA12_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA12_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA13_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA13_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA13_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA14_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA14_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA14_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA15_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA15_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA15_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA16_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA16_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA16_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA18_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA18_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA18_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA19_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA19_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA19_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA22_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA22_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA22_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA4_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA4_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA4_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA5_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA5_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA5_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA6_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA6_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA6_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA7_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA7_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA7_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA8_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA8_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA8_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA9_KcEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA9_KcEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRA9_KcEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRNS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRNS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8NameTypeEJRNS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8QualTypeEJRPNS2_4NodeERNS2_10QualifiersEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8QualTypeEJRPNS2_4NodeERNS2_10QualifiersEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle8QualTypeEJRPNS2_4NodeERNS2_10QualifiersEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9ArrayTypeEJRPNS2_4NodeERNS2_12NodeOrStringEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9ArrayTypeEJRPNS2_4NodeERNS2_12NodeOrStringEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9ArrayTypeEJRPNS2_4NodeERNS2_12NodeOrStringEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9DotSuffixEJRPNS2_4NodeENS_10StringViewEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9DotSuffixEJRPNS2_4NodeENS_10StringViewEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9DotSuffixEJRPNS2_4NodeENS_10StringViewEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9LocalNameEJRPNS2_4NodeES6_EEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9LocalNameEJRPNS2_4NodeES6_EEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9LocalNameEJRPNS2_4NodeES6_EEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9ThrowExprEJRPNS2_4NodeEEEEPT_DpOT0_ = Module["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9ThrowExprEJRPNS2_4NodeEEEEPT_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocator8makeNodeINS_16itanium_demangle9ThrowExprEJRPNS2_4NodeEEEEPT_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocatorC2Ev = Module["__ZN12_GLOBAL__N_116DefaultAllocatorC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocatorC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116DefaultAllocatorD2Ev = Module["__ZN12_GLOBAL__N_116DefaultAllocatorD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116DefaultAllocatorD2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10AbiTagAttrC2EPNS0_4NodeENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle10AbiTagAttrC2EPNS0_4NodeENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10AbiTagAttrC2EPNS0_4NodeENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10AbiTagAttrD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle10AbiTagAttrD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10AbiTagAttrD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10BinaryExprC2EPKNS0_4NodeENS_10StringViewES4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle10BinaryExprC2EPKNS0_4NodeENS_10StringViewES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10BinaryExprC2EPKNS0_4NodeENS_10StringViewES4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10BinaryExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle10BinaryExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10BinaryExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10BracedExprC2EPKNS0_4NodeES4_b = Module["__ZN12_GLOBAL__N_116itanium_demangle10BracedExprC2EPKNS0_4NodeES4_b"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10BracedExprC2EPKNS0_4NodeES4_b"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10BracedExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle10BracedExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10BracedExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10DeleteExprC2EPNS0_4NodeEbb = Module["__ZN12_GLOBAL__N_116itanium_demangle10DeleteExprC2EPNS0_4NodeEbb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10DeleteExprC2EPNS0_4NodeEbb"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10DeleteExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle10DeleteExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10DeleteExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10MemberExprC2EPKNS0_4NodeENS_10StringViewES4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle10MemberExprC2EPKNS0_4NodeENS_10StringViewES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10MemberExprC2EPKNS0_4NodeENS_10StringViewES4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10MemberExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle10MemberExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10MemberExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10NestedNameC2EPNS0_4NodeES3_ = Module["__ZN12_GLOBAL__N_116itanium_demangle10NestedNameC2EPNS0_4NodeES3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10NestedNameC2EPNS0_4NodeES3_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10NestedNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle10NestedNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10NestedNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10PrefixExprC2ENS_10StringViewEPNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle10PrefixExprC2ENS_10StringViewEPNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10PrefixExprC2ENS_10StringViewEPNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10PrefixExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle10PrefixExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10PrefixExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10VectorTypeC2EPKNS0_4NodeENS0_12NodeOrStringE = Module["__ZN12_GLOBAL__N_116itanium_demangle10VectorTypeC2EPKNS0_4NodeENS0_12NodeOrStringE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10VectorTypeC2EPKNS0_4NodeENS0_12NodeOrStringE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle10VectorTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle10VectorTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle10VectorTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle11PointerTypeC2EPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle11PointerTypeC2EPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle11PointerTypeC2EPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle11PointerTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle11PointerTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle11PointerTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle11PostfixExprC2EPKNS0_4NodeENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle11PostfixExprC2EPKNS0_4NodeENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle11PostfixExprC2EPKNS0_4NodeENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle11PostfixExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle11PostfixExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle11PostfixExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle11SpecialNameC2ENS_10StringViewEPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle11SpecialNameC2ENS_10StringViewEPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle11SpecialNameC2ENS_10StringViewEPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle11SpecialNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle11SpecialNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle11SpecialNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12CtorDtorNameC2EPKNS0_4NodeEbi = Module["__ZN12_GLOBAL__N_116itanium_demangle12CtorDtorNameC2EPKNS0_4NodeEbi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12CtorDtorNameC2EPKNS0_4NodeEbi"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12CtorDtorNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle12CtorDtorNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12CtorDtorNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12EnableIfAttrC2ENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle12EnableIfAttrC2ENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12EnableIfAttrC2ENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12EnableIfAttrD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle12EnableIfAttrD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12EnableIfAttrD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12FunctionTypeC2EPKNS0_4NodeENS0_9NodeArrayENS0_10QualifiersENS0_15FunctionRefQualES4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle12FunctionTypeC2EPKNS0_4NodeENS0_9NodeArrayENS0_10QualifiersENS0_15FunctionRefQualES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12FunctionTypeC2EPKNS0_4NodeENS0_9NodeArrayENS0_10QualifiersENS0_15FunctionRefQualES4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12FunctionTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle12FunctionTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12FunctionTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12InitListExprC2EPKNS0_4NodeENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle12InitListExprC2EPKNS0_4NodeENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12InitListExprC2EPKNS0_4NodeENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12InitListExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle12InitListExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12InitListExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2ENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2ENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2ENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2EPNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2EPNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2EPNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12NodeOrStringC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12NoexceptSpecC2EPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle12NoexceptSpecC2EPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12NoexceptSpecC2EPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12NoexceptSpecD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle12NoexceptSpecD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12NoexceptSpecD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12TemplateArgsC2ENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle12TemplateArgsC2ENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12TemplateArgsC2ENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle12TemplateArgsD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle12TemplateArgsD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle12TemplateArgsD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13EnclosingExprC2ENS_10StringViewEPNS0_4NodeES2_ = Module["__ZN12_GLOBAL__N_116itanium_demangle13EnclosingExprC2ENS_10StringViewEPNS0_4NodeES2_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13EnclosingExprC2ENS_10StringViewEPNS0_4NodeES2_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13EnclosingExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle13EnclosingExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13EnclosingExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13FunctionParamC2ENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle13FunctionParamC2ENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13FunctionParamC2ENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13FunctionParamD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle13FunctionParamD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13FunctionParamD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13NodeArrayNodeC2ENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle13NodeArrayNodeC2ENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13NodeArrayNodeC2ENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13NodeArrayNodeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle13NodeArrayNodeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13NodeArrayNodeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13ObjCProtoNameC2EPKNS0_4NodeENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle13ObjCProtoNameC2EPKNS0_4NodeENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13ObjCProtoNameC2EPKNS0_4NodeENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13ObjCProtoNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle13ObjCProtoNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13ObjCProtoNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13ParameterPackC2ENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle13ParameterPackC2ENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13ParameterPackC2ENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13ParameterPackD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle13ParameterPackD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13ParameterPackD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13QualifiedNameC2EPKNS0_4NodeES4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle13QualifiedNameC2EPKNS0_4NodeES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13QualifiedNameC2EPKNS0_4NodeES4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13QualifiedNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle13QualifiedNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13QualifiedNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13ReferenceTypeC2EPKNS0_4NodeENS0_13ReferenceKindE = Module["__ZN12_GLOBAL__N_116itanium_demangle13ReferenceTypeC2EPKNS0_4NodeENS0_13ReferenceKindE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13ReferenceTypeC2EPKNS0_4NodeENS0_13ReferenceKindE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle13ReferenceTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle13ReferenceTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle13ReferenceTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14ConversionExprC2EPKNS0_4NodeENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle14ConversionExprC2EPKNS0_4NodeENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14ConversionExprC2EPKNS0_4NodeENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14ConversionExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle14ConversionExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14ConversionExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14IntegerLiteralC2ENS_10StringViewES2_ = Module["__ZN12_GLOBAL__N_116itanium_demangle14IntegerLiteralC2ENS_10StringViewES2_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14IntegerLiteralC2ENS_10StringViewES2_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14IntegerLiteralD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle14IntegerLiteralD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14IntegerLiteralD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14ManglingParserINS_16DefaultAllocatorEECI2NS0_22AbstractManglingParserIS3_S2_EEEPKcS6_ = Module["__ZN12_GLOBAL__N_116itanium_demangle14ManglingParserINS_16DefaultAllocatorEECI2NS0_22AbstractManglingParserIS3_S2_EEEPKcS6_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14ManglingParserINS_16DefaultAllocatorEECI2NS0_22AbstractManglingParserIS3_S2_EEEPKcS6_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE5beginEv = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE5beginEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE5beginEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE7reserveEm = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE7reserveEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE7reserveEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE8dropBackEm = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE8dropBackEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE8dropBackEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE9push_backERKS3_ = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE9push_backERKS3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE9push_backERKS3_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EEC2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EEC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EEC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EED2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EED2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EEixEm = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EEixEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EEixEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE3endEv = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE3endEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE3endEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE5beginEv = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE5beginEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE5beginEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE7reserveEm = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE7reserveEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE7reserveEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8dropBackEm = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8dropBackEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8dropBackEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8pop_backEv = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8pop_backEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8pop_backEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE9push_backERKS3_ = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE9push_backERKS3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE9push_backERKS3_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EEC2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EEC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EEC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EED2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EED2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EEixEm = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EEixEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EEixEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE11clearInlineEv = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE11clearInlineEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE11clearInlineEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE3endEv = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE3endEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE3endEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE5beginEv = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE5beginEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE5beginEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE5clearEv = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE5clearEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE5clearEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE7reserveEm = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE7reserveEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE7reserveEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE9push_backERKS3_ = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE9push_backERKS3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE9push_backERKS3_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEC2EOS4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEC2EOS4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEC2EOS4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEC2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EED2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EED2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEaSEOS4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEaSEOS4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEaSEOS4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEixEm = Module["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEixEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EEixEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15BracedRangeExprC2EPKNS0_4NodeES4_S4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle15BracedRangeExprC2EPKNS0_4NodeES4_S4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15BracedRangeExprC2EPKNS0_4NodeES4_S4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15BracedRangeExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle15BracedRangeExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15BracedRangeExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15ClosureTypeNameC2ENS0_9NodeArrayENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle15ClosureTypeNameC2ENS0_9NodeArrayENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15ClosureTypeNameC2ENS0_9NodeArrayENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15ClosureTypeNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle15ClosureTypeNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15ClosureTypeNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15ConditionalExprC2EPKNS0_4NodeES4_S4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle15ConditionalExprC2EPKNS0_4NodeES4_S4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15ConditionalExprC2EPKNS0_4NodeES4_S4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15ConditionalExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle15ConditionalExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15ConditionalExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15IntegerCastExprC2EPKNS0_4NodeENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle15IntegerCastExprC2EPKNS0_4NodeENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15IntegerCastExprC2EPKNS0_4NodeENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15IntegerCastExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle15IntegerCastExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15IntegerCastExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15LiteralOperatorC2EPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle15LiteralOperatorC2EPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15LiteralOperatorC2EPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15LiteralOperatorD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle15LiteralOperatorD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15LiteralOperatorD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15PixelVectorTypeC2ENS0_12NodeOrStringE = Module["__ZN12_GLOBAL__N_116itanium_demangle15PixelVectorTypeC2ENS0_12NodeOrStringE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15PixelVectorTypeC2ENS0_12NodeOrStringE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15PixelVectorTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle15PixelVectorTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15PixelVectorTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15UnnamedTypeNameC2ENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle15UnnamedTypeNameC2ENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15UnnamedTypeNameC2ENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle15UnnamedTypeNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle15UnnamedTypeNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle15UnnamedTypeNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdEC2ENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdEC2ENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdEC2ENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdED0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdED0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeEC2ENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeEC2ENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeEC2ENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeED0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeED0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfEC2ENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfEC2ENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfEC2ENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfED0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfED0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfED0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16FunctionEncodingC2EPKNS0_4NodeES4_NS0_9NodeArrayES4_NS0_10QualifiersENS0_15FunctionRefQualE = Module["__ZN12_GLOBAL__N_116itanium_demangle16FunctionEncodingC2EPKNS0_4NodeES4_NS0_9NodeArrayES4_NS0_10QualifiersENS0_15FunctionRefQualE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16FunctionEncodingC2EPKNS0_4NodeES4_NS0_9NodeArrayES4_NS0_10QualifiersENS0_15FunctionRefQualE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16FunctionEncodingD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle16FunctionEncodingD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16FunctionEncodingD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16StdQualifiedNameC2EPNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle16StdQualifiedNameC2EPNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16StdQualifiedNameC2EPNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle16StdQualifiedNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle16StdQualifiedNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle16StdQualifiedNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle17VendorExtQualTypeC2EPKNS0_4NodeENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle17VendorExtQualTypeC2EPKNS0_4NodeENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle17VendorExtQualTypeC2EPKNS0_4NodeENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle17VendorExtQualTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle17VendorExtQualTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle17VendorExtQualTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle18ArraySubscriptExprC2EPKNS0_4NodeES4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle18ArraySubscriptExprC2EPKNS0_4NodeES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle18ArraySubscriptExprC2EPKNS0_4NodeES4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle18ArraySubscriptExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle18ArraySubscriptExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle18ArraySubscriptExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19GlobalQualifiedNameC2EPNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle19GlobalQualifiedNameC2EPNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19GlobalQualifiedNameC2EPNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19GlobalQualifiedNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle19GlobalQualifiedNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19GlobalQualifiedNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19PointerToMemberTypeC2EPKNS0_4NodeES4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle19PointerToMemberTypeC2EPKNS0_4NodeES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19PointerToMemberTypeC2EPKNS0_4NodeES4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19PointerToMemberTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle19PointerToMemberTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19PointerToMemberTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19SizeofParamPackExprC2EPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle19SizeofParamPackExprC2EPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19SizeofParamPackExprC2EPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19SizeofParamPackExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle19SizeofParamPackExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19SizeofParamPackExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19SpecialSubstitutionC2ENS0_14SpecialSubKindE = Module["__ZN12_GLOBAL__N_116itanium_demangle19SpecialSubstitutionC2ENS0_14SpecialSubKindE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19SpecialSubstitutionC2ENS0_14SpecialSubKindE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19SpecialSubstitutionD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle19SpecialSubstitutionD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19SpecialSubstitutionD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle19parse_discriminatorEPKcS2_ = Module["__ZN12_GLOBAL__N_116itanium_demangle19parse_discriminatorEPKcS2_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle19parse_discriminatorEPKcS2_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpecC2ENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpecC2ENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpecC2ENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpecD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpecD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpecD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgsC2EPNS0_4NodeES3_ = Module["__ZN12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgsC2EPNS0_4NodeES3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgsC2EPNS0_4NodeES3_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgsD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgsD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgsD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle20PostfixQualifiedTypeC2EPNS0_4NodeENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle20PostfixQualifiedTypeC2EPNS0_4NodeENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle20PostfixQualifiedTypeC2EPNS0_4NodeENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle20PostfixQualifiedTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle20PostfixQualifiedTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle20PostfixQualifiedTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle20TemplateArgumentPackC2ENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle20TemplateArgumentPackC2ENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle20TemplateArgumentPackC2ENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle20TemplateArgumentPackD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle20TemplateArgumentPackD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle20TemplateArgumentPackD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialNameC2EPKNS0_4NodeES4_ = Module["__ZN12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialNameC2EPKNS0_4NodeES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialNameC2EPKNS0_4NodeES4_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle21StructuredBindingNameC2ENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle21StructuredBindingNameC2ENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle21StructuredBindingNameC2ENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle21StructuredBindingNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle21StructuredBindingNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle21StructuredBindingNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E10getDerivedEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E10getDerivedEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E10getDerivedEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E10parseSeqIdEPm = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E10parseSeqIdEPm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E10parseSeqIdEPm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E11parseNumberEb = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E11parseNumberEb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E11parseNumberEb"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E12parseAbiTagsEPNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E12parseAbiTagsEPNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E12parseAbiTagsEPNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E12parseNewExprEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E12parseNewExprEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E12parseNewExprEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13makeNodeArrayIPPNS0_4NodeEEENS0_9NodeArrayET_SB_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13makeNodeArrayIPPNS0_4NodeEEENS0_9NodeArrayET_SB_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13makeNodeArrayIPPNS0_4NodeEEENS0_9NodeArrayET_SB_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseDecltypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseDecltypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseDecltypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseEncodingEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseEncodingEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseEncodingEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseFoldExprEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseFoldExprEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseFoldExprEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseSimpleIdEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseSimpleIdEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseSimpleIdEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E14parseArrayTypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E14parseArrayTypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E14parseArrayTypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E14parseLocalNameEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E14parseLocalNameEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E14parseLocalNameEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseBinaryExprENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseBinaryExprENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseBinaryExprENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseBracedExprEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseBracedExprEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseBracedExprEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseCallOffsetEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseCallOffsetEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseCallOffsetEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseNestedNameEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseNestedNameEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseNestedNameEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parsePrefixExprENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parsePrefixExprENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parsePrefixExprENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseSourceNameEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseSourceNameEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseSourceNameEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseVectorTypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseVectorTypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseVectorTypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseExprPrimaryEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseExprPrimaryEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseExprPrimaryEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseSpecialNameEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseSpecialNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseSpecialNameEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseTemplateArgEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseTemplateArgEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E16parseTemplateArgEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseCVQualifiersEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseCVQualifiersEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseCVQualifiersEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseCtorDtorNameERPNS0_4NodeEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseCtorDtorNameERPNS0_4NodeEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseCtorDtorNameERPNS0_4NodeEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseFunctionTypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseFunctionTypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseFunctionTypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseOperatorNameEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseOperatorNameEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseOperatorNameEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseSubstitutionEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseSubstitutionEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseSubstitutionEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseTemplateArgsEb = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseTemplateArgsEb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseTemplateArgsEb"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseUnscopedNameEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseUnscopedNameEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E17parseUnscopedNameEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseClassEnumTypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseClassEnumTypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseClassEnumTypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseFunctionParamEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseFunctionParamEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseFunctionParamEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseQualifiedTypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseQualifiedTypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseQualifiedTypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseTemplateParamEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseTemplateParamEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E18parseTemplateParamEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseBareSourceNameEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseBareSourceNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseBareSourceNameEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseConversionExprEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseConversionExprEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseConversionExprEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseDestructorNameEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseDestructorNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseDestructorNameEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseIntegerLiteralENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseIntegerLiteralENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseIntegerLiteralENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseUnresolvedNameEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseUnresolvedNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseUnresolvedNameEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseUnresolvedTypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseUnresolvedTypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E19parseUnresolvedTypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIdEEPNS0_4NodeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIdEEPNS0_4NodeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIdEEPNS0_4NodeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIeEEPNS0_4NodeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIeEEPNS0_4NodeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIeEEPNS0_4NodeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIfEEPNS0_4NodeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIfEEPNS0_4NodeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseFloatingLiteralIfEEPNS0_4NodeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parsePositiveIntegerEPm = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parsePositiveIntegerEPm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parsePositiveIntegerEPm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseUnnamedTypeNameEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseUnnamedTypeNameEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseUnnamedTypeNameEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseUnqualifiedNameEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseUnqualifiedNameEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20parseUnqualifiedNameEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20popTrailingNodeArrayEm = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20popTrailingNodeArrayEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E20popTrailingNodeArrayEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E23parseBaseUnresolvedNameEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E23parseBaseUnresolvedNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E23parseBaseUnresolvedNameEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E24parsePointerToMemberTypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E24parsePointerToMemberTypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E24parsePointerToMemberTypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E26resolveForwardTemplateRefsERNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E26resolveForwardTemplateRefsERNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E26resolveForwardTemplateRefsERNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4lookEj = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4lookEj"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4lookEj"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10AbiTagAttrEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10AbiTagAttrEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10AbiTagAttrEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10BinaryExprEJRPNS0_4NodeERNS_10StringViewESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10BinaryExprEJRPNS0_4NodeERNS_10StringViewESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10BinaryExprEJRPNS0_4NodeERNS_10StringViewESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10BracedExprEJRPNS0_4NodeESA_bEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10BracedExprEJRPNS0_4NodeESA_bEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10BracedExprEJRPNS0_4NodeESA_bEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10DeleteExprEJRPNS0_4NodeERbbEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10DeleteExprEJRPNS0_4NodeERbbEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10DeleteExprEJRPNS0_4NodeERbbEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10MemberExprEJRPNS0_4NodeERA2_KcSA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10MemberExprEJRPNS0_4NodeERA2_KcSA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10MemberExprEJRPNS0_4NodeERA2_KcSA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10MemberExprEJRPNS0_4NodeERA3_KcSA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10MemberExprEJRPNS0_4NodeERA3_KcSA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10MemberExprEJRPNS0_4NodeERA3_KcSA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10NestedNameEJRPNS0_4NodeESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10NestedNameEJRPNS0_4NodeESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10NestedNameEJRPNS0_4NodeESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10PrefixExprEJRNS_10StringViewERPNS0_4NodeEEEESB_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10PrefixExprEJRNS_10StringViewERPNS0_4NodeEEEESB_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10PrefixExprEJRNS_10StringViewERPNS0_4NodeEEEESB_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeENS_10StringViewEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeENS_10StringViewEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeENS_10StringViewEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_10VectorTypeEJRPNS0_4NodeESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11PointerTypeEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11PointerTypeEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11PointerTypeEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11PostfixExprEJRPNS0_4NodeERA3_KcEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11PostfixExprEJRPNS0_4NodeERA3_KcEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11PostfixExprEJRPNS0_4NodeERA3_KcEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA12_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA12_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA12_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA14_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA14_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA14_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA18_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA18_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA18_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA19_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA19_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA19_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA20_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA20_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA20_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA22_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA22_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA22_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA25_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA25_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA25_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA27_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA27_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA27_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA34_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA34_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA34_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA41_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA41_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA41_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA9_KcRPNS0_4NodeEEEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA9_KcRPNS0_4NodeEEEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_11SpecialNameEJRA9_KcRPNS0_4NodeEEEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12CtorDtorNameEJRPNS0_4NodeEbRiEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12CtorDtorNameEJRPNS0_4NodeEbRiEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12CtorDtorNameEJRPNS0_4NodeEbRiEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12EnableIfAttrEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12EnableIfAttrEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12EnableIfAttrEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12FunctionTypeEJRPNS0_4NodeERNS0_9NodeArrayERNS0_10QualifiersERNS0_15FunctionRefQualESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12FunctionTypeEJRPNS0_4NodeERNS0_9NodeArrayERNS0_10QualifiersERNS0_15FunctionRefQualESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12FunctionTypeEJRPNS0_4NodeERNS0_9NodeArrayERNS0_10QualifiersERNS0_15FunctionRefQualESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12InitListExprEJDnNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12InitListExprEJDnNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12InitListExprEJDnNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12InitListExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12InitListExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12InitListExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12NoexceptSpecEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12NoexceptSpecEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12NoexceptSpecEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12TemplateArgsEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12TemplateArgsEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_12TemplateArgsEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA10_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA10_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA10_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA11_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA11_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA11_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA12_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA12_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA12_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA9_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA9_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13EnclosingExprEJRA9_KcRPNS0_4NodeERA2_S8_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13FunctionParamEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13FunctionParamEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13FunctionParamEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13NodeArrayNodeEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13NodeArrayNodeEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13NodeArrayNodeEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ObjCProtoNameEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ObjCProtoNameEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ObjCProtoNameEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ParameterPackEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ParameterPackEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ParameterPackEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13QualifiedNameEJRPNS0_4NodeESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13QualifiedNameEJRPNS0_4NodeESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13QualifiedNameEJRPNS0_4NodeESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ReferenceTypeEJRPNS0_4NodeENS0_13ReferenceKindEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ReferenceTypeEJRPNS0_4NodeENS0_13ReferenceKindEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_13ReferenceTypeEJRPNS0_4NodeENS0_13ReferenceKindEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14ConversionExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14ConversionExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14ConversionExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14ConversionExprEJRPNS0_4NodeERNS0_9NodeArrayEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14ConversionExprEJRPNS0_4NodeERNS0_9NodeArrayEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14ConversionExprEJRPNS0_4NodeERNS0_9NodeArrayEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14IntegerLiteralEJRNS_10StringViewES9_EEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14IntegerLiteralEJRNS_10StringViewES9_EEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_14IntegerLiteralEJRNS_10StringViewES9_EEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15BracedRangeExprEJRPNS0_4NodeESA_SA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15BracedRangeExprEJRPNS0_4NodeESA_SA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15BracedRangeExprEJRPNS0_4NodeESA_SA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15ClosureTypeNameEJRNS0_9NodeArrayERNS_10StringViewEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15ClosureTypeNameEJRNS0_9NodeArrayERNS_10StringViewEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15ClosureTypeNameEJRNS0_9NodeArrayERNS_10StringViewEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15ConditionalExprEJRPNS0_4NodeESA_SA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15ConditionalExprEJRPNS0_4NodeESA_SA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15ConditionalExprEJRPNS0_4NodeESA_SA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15IntegerCastExprEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15IntegerCastExprEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15IntegerCastExprEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15LiteralOperatorEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15LiteralOperatorEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15LiteralOperatorEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15PixelVectorTypeEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15PixelVectorTypeEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15PixelVectorTypeEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15UnnamedTypeNameEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15UnnamedTypeNameEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_15UnnamedTypeNameEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIdEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIdEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIdEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIeEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIeEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIeEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIfEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIfEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FloatLiteralImplIfEEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FunctionEncodingEJRPNS0_4NodeESA_NS0_9NodeArrayESA_RNS0_10QualifiersERNS0_15FunctionRefQualEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FunctionEncodingEJRPNS0_4NodeESA_NS0_9NodeArrayESA_RNS0_10QualifiersERNS0_15FunctionRefQualEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16FunctionEncodingEJRPNS0_4NodeESA_NS0_9NodeArrayESA_RNS0_10QualifiersERNS0_15FunctionRefQualEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16StdQualifiedNameEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16StdQualifiedNameEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_16StdQualifiedNameEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_17VendorExtQualTypeEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_17VendorExtQualTypeEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_17VendorExtQualTypeEJRPNS0_4NodeERNS_10StringViewEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_18ArraySubscriptExprEJRPNS0_4NodeESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_18ArraySubscriptExprEJRPNS0_4NodeESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_18ArraySubscriptExprEJRPNS0_4NodeESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19GlobalQualifiedNameEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19GlobalQualifiedNameEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19GlobalQualifiedNameEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19PointerToMemberTypeEJRPNS0_4NodeESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19PointerToMemberTypeEJRPNS0_4NodeESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19PointerToMemberTypeEJRPNS0_4NodeESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19SizeofParamPackExprEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19SizeofParamPackExprEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19SizeofParamPackExprEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19SpecialSubstitutionEJNS0_14SpecialSubKindEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19SpecialSubstitutionEJNS0_14SpecialSubKindEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_19SpecialSubstitutionEJNS0_14SpecialSubKindEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20DynamicExceptionSpecEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20DynamicExceptionSpecEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20DynamicExceptionSpecEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20NameWithTemplateArgsEJRPNS0_4NodeESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20NameWithTemplateArgsEJRPNS0_4NodeESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20NameWithTemplateArgsEJRPNS0_4NodeESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20PostfixQualifiedTypeEJRPNS0_4NodeERA11_KcEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20PostfixQualifiedTypeEJRPNS0_4NodeERA11_KcEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20PostfixQualifiedTypeEJRPNS0_4NodeERA11_KcEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20PostfixQualifiedTypeEJRPNS0_4NodeERA9_KcEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20PostfixQualifiedTypeEJRPNS0_4NodeERA9_KcEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20PostfixQualifiedTypeEJRPNS0_4NodeERA9_KcEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20TemplateArgumentPackEJRNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20TemplateArgumentPackEJRNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_20TemplateArgumentPackEJRNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_21CtorVtableSpecialNameEJRPNS0_4NodeESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_21CtorVtableSpecialNameEJRPNS0_4NodeESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_21CtorVtableSpecialNameEJRPNS0_4NodeESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_21StructuredBindingNameEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_21StructuredBindingNameEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_21StructuredBindingNameEJNS0_9NodeArrayEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ConversionOperatorTypeEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ConversionOperatorTypeEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ConversionOperatorTypeEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ElaboratedTypeSpefTypeEJRNS_10StringViewERPNS0_4NodeEEEESB_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ElaboratedTypeSpefTypeEJRNS_10StringViewERPNS0_4NodeEEEESB_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ElaboratedTypeSpefTypeEJRNS_10StringViewERPNS0_4NodeEEEESB_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ParameterPackExpansionEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ParameterPackExpansionEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_22ParameterPackExpansionEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_24ForwardTemplateReferenceEJRmEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_24ForwardTemplateReferenceEJRmEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_24ForwardTemplateReferenceEJRmEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_27ExpandedSpecialSubstitutionEJRNS0_14SpecialSubKindEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_27ExpandedSpecialSubstitutionEJRNS0_14SpecialSubKindEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_27ExpandedSpecialSubstitutionEJRNS0_14SpecialSubKindEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_7NewExprEJRNS0_9NodeArrayERPNS0_4NodeES8_RbSD_EEESB_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_7NewExprEJRNS0_9NodeArrayERPNS0_4NodeES8_RbSD_EEESB_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_7NewExprEJRNS0_9NodeArrayERPNS0_4NodeES8_RbSD_EEESB_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_7NewExprEJRNS0_9NodeArrayERPNS0_4NodeES9_RbSD_EEESB_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_7NewExprEJRNS0_9NodeArrayERPNS0_4NodeES9_RbSD_EEESB_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_7NewExprEJRNS0_9NodeArrayERPNS0_4NodeES9_RbSD_EEESB_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8BoolExprEJiEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8BoolExprEJiEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8BoolExprEJiEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CallExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CallExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CallExprEJRPNS0_4NodeENS0_9NodeArrayEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA11_KcRPNS0_4NodeESD_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA11_KcRPNS0_4NodeESD_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA11_KcRPNS0_4NodeESD_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA12_KcRPNS0_4NodeESD_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA12_KcRPNS0_4NodeESD_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA12_KcRPNS0_4NodeESD_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA13_KcRPNS0_4NodeESD_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA13_KcRPNS0_4NodeESD_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA13_KcRPNS0_4NodeESD_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA17_KcRPNS0_4NodeESD_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA17_KcRPNS0_4NodeESD_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8CastExprEJRA17_KcRPNS0_4NodeESD_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8DtorNameEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8DtorNameEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8DtorNameEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8FoldExprEJRbRNS_10StringViewERPNS0_4NodeESD_EEESC_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8FoldExprEJRbRNS_10StringViewERPNS0_4NodeESD_EEESC_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8FoldExprEJRbRNS_10StringViewERPNS0_4NodeESD_EEESC_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA10_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA10_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA10_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA11_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA11_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA11_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA12_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA12_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA12_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA13_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA13_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA13_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA14_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA14_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA14_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA15_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA15_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA15_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA16_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA16_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA16_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA18_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA18_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA18_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA19_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA19_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA19_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA22_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA22_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA22_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA4_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA4_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA4_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA5_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA5_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA5_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA6_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA6_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA6_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA7_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA7_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA7_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA8_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA8_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA8_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA9_KcEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA9_KcEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRA9_KcEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8NameTypeEJRNS_10StringViewEEEEPNS0_4NodeEDpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8QualTypeEJRPNS0_4NodeERNS0_10QualifiersEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8QualTypeEJRPNS0_4NodeERNS0_10QualifiersEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_8QualTypeEJRPNS0_4NodeERNS0_10QualifiersEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9ArrayTypeEJRPNS0_4NodeERNS0_12NodeOrStringEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9ArrayTypeEJRPNS0_4NodeERNS0_12NodeOrStringEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9ArrayTypeEJRPNS0_4NodeERNS0_12NodeOrStringEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9DotSuffixEJRPNS0_4NodeENS_10StringViewEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9DotSuffixEJRPNS0_4NodeENS_10StringViewEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9DotSuffixEJRPNS0_4NodeENS_10StringViewEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9LocalNameEJRPNS0_4NodeESA_EEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9LocalNameEJRPNS0_4NodeESA_EEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9LocalNameEJRPNS0_4NodeESA_EEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9ThrowExprEJRPNS0_4NodeEEEES9_DpOT0_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9ThrowExprEJRPNS0_4NodeEEEES9_DpOT0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E4makeINS0_9ThrowExprEJRPNS0_4NodeEEEES9_DpOT0_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E5parseEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E5parseEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E5parseEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E7consumeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E7consumeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E7consumeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9NameStateC2EPS5_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9NameStateC2EPS5_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9NameStateC2EPS5_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9consumeIfENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9consumeIfENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9consumeIfENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9consumeIfEc = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9consumeIfEc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9consumeIfEc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseExprEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseExprEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseExprEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseNameEPNS5_9NameStateE = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseNameEPNS5_9NameStateE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseNameEPNS5_9NameStateE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseTypeEv = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseTypeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E9parseTypeEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_EC2EPKcS7_ = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_EC2EPKcS7_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_EC2EPKcS7_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_ED2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_ED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_ED2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22ConversionOperatorTypeC2EPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle22ConversionOperatorTypeC2EPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22ConversionOperatorTypeC2EPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22ConversionOperatorTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle22ConversionOperatorTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22ConversionOperatorTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefTypeC2ENS_10StringViewEPNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefTypeC2ENS_10StringViewEPNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefTypeC2ENS_10StringViewEPNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22ParameterPackExpansionC2EPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle22ParameterPackExpansionC2EPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22ParameterPackExpansionC2EPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle22ParameterPackExpansionD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle22ParameterPackExpansionD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle22ParameterPackExpansionD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle24ForwardTemplateReferenceC2Em = Module["__ZN12_GLOBAL__N_116itanium_demangle24ForwardTemplateReferenceC2Em"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle24ForwardTemplateReferenceC2Em"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle24ForwardTemplateReferenceD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle24ForwardTemplateReferenceD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle24ForwardTemplateReferenceD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitutionC2ENS0_14SpecialSubKindE = Module["__ZN12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitutionC2ENS0_14SpecialSubKindE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitutionC2ENS0_14SpecialSubKindE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitutionD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitutionD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitutionD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle4NodeC2ENS1_4KindENS1_5CacheES3_S3_ = Module["__ZN12_GLOBAL__N_116itanium_demangle4NodeC2ENS1_4KindENS1_5CacheES3_S3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle4NodeC2ENS1_4KindENS1_5CacheES3_S3_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle4NodeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle4NodeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle4NodeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle4NodeD2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle4NodeD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle4NodeD2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle7NewExprC2ENS0_9NodeArrayEPNS0_4NodeES2_bb = Module["__ZN12_GLOBAL__N_116itanium_demangle7NewExprC2ENS0_9NodeArrayEPNS0_4NodeES2_bb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle7NewExprC2ENS0_9NodeArrayEPNS0_4NodeES2_bb"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle7NewExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle7NewExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle7NewExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8BoolExprC2Eb = Module["__ZN12_GLOBAL__N_116itanium_demangle8BoolExprC2Eb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8BoolExprC2Eb"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8BoolExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle8BoolExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8BoolExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8CallExprC2EPKNS0_4NodeENS0_9NodeArrayE = Module["__ZN12_GLOBAL__N_116itanium_demangle8CallExprC2EPKNS0_4NodeENS0_9NodeArrayE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8CallExprC2EPKNS0_4NodeENS0_9NodeArrayE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8CallExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle8CallExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8CallExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8CastExprC2ENS_10StringViewEPKNS0_4NodeES5_ = Module["__ZN12_GLOBAL__N_116itanium_demangle8CastExprC2ENS_10StringViewEPKNS0_4NodeES5_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8CastExprC2ENS_10StringViewEPKNS0_4NodeES5_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8CastExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle8CastExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8CastExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8DtorNameC2EPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle8DtorNameC2EPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8DtorNameC2EPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8DtorNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle8DtorNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8DtorNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8FoldExprC2EbNS_10StringViewEPKNS0_4NodeES5_ = Module["__ZN12_GLOBAL__N_116itanium_demangle8FoldExprC2EbNS_10StringViewEPKNS0_4NodeES5_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8FoldExprC2EbNS_10StringViewEPKNS0_4NodeES5_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8FoldExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle8FoldExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8FoldExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8NameTypeC2ENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle8NameTypeC2ENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8NameTypeC2ENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8NameTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle8NameTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8NameTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8QualTypeC2EPKNS0_4NodeENS0_10QualifiersE = Module["__ZN12_GLOBAL__N_116itanium_demangle8QualTypeC2EPKNS0_4NodeENS0_10QualifiersE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8QualTypeC2EPKNS0_4NodeENS0_10QualifiersE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle8QualTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle8QualTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle8QualTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9ArrayTypeC2EPKNS0_4NodeENS0_12NodeOrStringE = Module["__ZN12_GLOBAL__N_116itanium_demangle9ArrayTypeC2EPKNS0_4NodeENS0_12NodeOrStringE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9ArrayTypeC2EPKNS0_4NodeENS0_12NodeOrStringE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9ArrayTypeD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle9ArrayTypeD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9ArrayTypeD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9DotSuffixC2EPKNS0_4NodeENS_10StringViewE = Module["__ZN12_GLOBAL__N_116itanium_demangle9DotSuffixC2EPKNS0_4NodeENS_10StringViewE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9DotSuffixC2EPKNS0_4NodeENS_10StringViewE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9DotSuffixD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle9DotSuffixD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9DotSuffixD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9LocalNameC2EPNS0_4NodeES3_ = Module["__ZN12_GLOBAL__N_116itanium_demangle9LocalNameC2EPNS0_4NodeES3_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9LocalNameC2EPNS0_4NodeES3_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9LocalNameD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle9LocalNameD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9LocalNameD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9NodeArrayC2EPPNS0_4NodeEm = Module["__ZN12_GLOBAL__N_116itanium_demangle9NodeArrayC2EPPNS0_4NodeEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9NodeArrayC2EPPNS0_4NodeEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9NodeArrayC2Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle9NodeArrayC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9NodeArrayC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9ThrowExprC2EPKNS0_4NodeE = Module["__ZN12_GLOBAL__N_116itanium_demangle9ThrowExprC2EPKNS0_4NodeE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9ThrowExprC2EPKNS0_4NodeE"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangle9ThrowExprD0Ev = Module["__ZN12_GLOBAL__N_116itanium_demangle9ThrowExprD0Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangle9ThrowExprD0Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116itanium_demangleoRERNS0_10QualifiersES1_ = Module["__ZN12_GLOBAL__N_116itanium_demangleoRERNS0_10QualifiersES1_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116itanium_demangleoRERNS0_10QualifiersES1_"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerIaEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerIaEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerIaEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerIcEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerIcEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerIcEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerIhEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerIhEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerIhEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerIiEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerIiEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerIiEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerIjEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerIjEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerIjEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerIlEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerIlEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerIlEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerImEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerImEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerImEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerIsEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerIsEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerIsEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_116register_integerItEEvPKc = Module["__ZN12_GLOBAL__N_116register_integerItEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_116register_integerItEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv = Module["__ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120BumpPointerAllocator15allocateMassiveEm = Module["__ZN12_GLOBAL__N_120BumpPointerAllocator15allocateMassiveEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120BumpPointerAllocator15allocateMassiveEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120BumpPointerAllocator4growEv = Module["__ZN12_GLOBAL__N_120BumpPointerAllocator4growEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120BumpPointerAllocator4growEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120BumpPointerAllocator5resetEv = Module["__ZN12_GLOBAL__N_120BumpPointerAllocator5resetEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120BumpPointerAllocator5resetEv"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120BumpPointerAllocator8allocateEm = Module["__ZN12_GLOBAL__N_120BumpPointerAllocator8allocateEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120BumpPointerAllocator8allocateEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120BumpPointerAllocatorC2Ev = Module["__ZN12_GLOBAL__N_120BumpPointerAllocatorC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120BumpPointerAllocatorC2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120BumpPointerAllocatorD2Ev = Module["__ZN12_GLOBAL__N_120BumpPointerAllocatorD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120BumpPointerAllocatorD2Ev"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIaEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIaEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIaEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIcEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIcEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIcEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIdEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIdEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIdEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIeEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIeEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIeEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIfEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIfEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIfEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIhEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIhEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIhEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIiEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIiEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIiEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIjEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIjEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIjEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIlEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIlEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIlEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewImEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewImEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewImEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewIsEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewIsEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewIsEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_120register_memory_viewItEEvPKc = Module["__ZN12_GLOBAL__N_120register_memory_viewItEEvPKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_120register_memory_viewItEEvPKc"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_122initializeOutputStreamEPcPmRNS_12OutputStreamEm = Module["__ZN12_GLOBAL__N_122initializeOutputStreamEPcPmRNS_12OutputStreamEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_122initializeOutputStreamEPcPmRNS_12OutputStreamEm"].apply(null, arguments)
};

var __ZN12_GLOBAL__N_1eqERKNS_10StringViewES2_ = Module["__ZN12_GLOBAL__N_1eqERKNS_10StringViewES2_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN12_GLOBAL__N_1eqERKNS_10StringViewES2_"].apply(null, arguments)
};

var __ZN38EmscriptenBindingInitializer_my_moduleC2Ev = Module["__ZN38EmscriptenBindingInitializer_my_moduleC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN38EmscriptenBindingInitializer_my_moduleC2Ev"].apply(null, arguments)
};

var __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev = Module["__ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev"].apply(null, arguments)
};

var __ZNK10__cxxabiv116__shim_type_info5noop1Ev = Module["__ZNK10__cxxabiv116__shim_type_info5noop1Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv116__shim_type_info5noop1Ev"].apply(null, arguments)
};

var __ZNK10__cxxabiv116__shim_type_info5noop2Ev = Module["__ZNK10__cxxabiv116__shim_type_info5noop2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv116__shim_type_info5noop2Ev"].apply(null, arguments)
};

var __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = Module["__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"].apply(null, arguments)
};

var __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = Module["__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"].apply(null, arguments)
};

var __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi = Module["__ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi"].apply(null, arguments)
};

var __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = Module["__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"].apply(null, arguments)
};

var __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i = Module["__ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i"].apply(null, arguments)
};

var __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi = Module["__ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi"].apply(null, arguments)
};

var __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv = Module["__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv"].apply(null, arguments)
};

var __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = Module["__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"].apply(null, arguments)
};

var __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = Module["__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"].apply(null, arguments)
};

var __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = Module["__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"].apply(null, arguments)
};

var __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = Module["__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"].apply(null, arguments)
};

var __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = Module["__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"].apply(null, arguments)
};

var __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = Module["__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"].apply(null, arguments)
};

var __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib = Module["__ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib"].apply(null, arguments)
};

var __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib = Module["__ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib"].apply(null, arguments)
};

var __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi = Module["__ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi"].apply(null, arguments)
};

var __ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv = Module["__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv"].apply(null, arguments)
};

var __ZNK10emscripten8internal12WireTypePackIJNS_11memory_viewIhEEEEcvPKvEv = Module["__ZNK10emscripten8internal12WireTypePackIJNS_11memory_viewIhEEEEcvPKvEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10emscripten8internal12WireTypePackIJNS_11memory_viewIhEEEEcvPKvEv"].apply(null, arguments)
};

var __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valEEE8getCountEv = Module["__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valEEE8getCountEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valEEE8getCountEv"].apply(null, arguments)
};

var __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valEEE8getTypesEv = Module["__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valEEE8getTypesEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valEEE8getTypesEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_110StringView10startsWithES0_ = Module["__ZNK12_GLOBAL__N_110StringView10startsWithES0_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_110StringView10startsWithES0_"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_110StringView3endEv = Module["__ZNK12_GLOBAL__N_110StringView3endEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_110StringView3endEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_110StringView4sizeEv = Module["__ZNK12_GLOBAL__N_110StringView4sizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_110StringView4sizeEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_110StringView5beginEv = Module["__ZNK12_GLOBAL__N_110StringView5beginEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_110StringView5beginEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_110StringView5emptyEv = Module["__ZNK12_GLOBAL__N_110StringView5emptyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_110StringView5emptyEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_110StringView9dropFrontEm = Module["__ZNK12_GLOBAL__N_110StringView9dropFrontEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_110StringView9dropFrontEm"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_110StringViewixEm = Module["__ZNK12_GLOBAL__N_110StringViewixEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_110StringViewixEm"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_112OutputStream18getCurrentPositionEv = Module["__ZNK12_GLOBAL__N_112OutputStream18getCurrentPositionEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_112OutputStream18getCurrentPositionEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_112OutputStream4backEv = Module["__ZNK12_GLOBAL__N_112OutputStream4backEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_112OutputStream4backEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10AbiTagAttr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle10AbiTagAttr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10AbiTagAttr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10BinaryExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle10BinaryExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10BinaryExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10BracedExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle10BracedExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10BracedExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10DeleteExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle10DeleteExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10DeleteExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10MemberExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle10MemberExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10MemberExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10NestedName11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle10NestedName11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10NestedName11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10NestedName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle10NestedName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10NestedName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10PrefixExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle10PrefixExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10PrefixExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle10VectorType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle10VectorType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle10VectorType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle11PointerType10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle11PointerType10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle11PointerType10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle11PointerType19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle11PointerType19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle11PointerType19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle11PointerType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle11PointerType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle11PointerType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle11PostfixExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle11PostfixExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle11PostfixExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle11SpecialName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle11SpecialName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle11SpecialName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12CtorDtorName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12CtorDtorName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12CtorDtorName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12EnableIfAttr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12EnableIfAttr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12EnableIfAttr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12FunctionType10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12FunctionType10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12FunctionType10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12FunctionType15hasFunctionSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12FunctionType15hasFunctionSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12FunctionType15hasFunctionSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12FunctionType19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12FunctionType19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12FunctionType19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12FunctionType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12FunctionType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12FunctionType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12InitListExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12InitListExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12InitListExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString6asNodeEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString6asNodeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString6asNodeEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString6isNodeEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString6isNodeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString6isNodeEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString8asStringEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString8asStringEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString8asStringEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString8isStringEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString8isStringEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12NodeOrString8isStringEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12NoexceptSpec9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12NoexceptSpec9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12NoexceptSpec9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle12TemplateArgs9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle12TemplateArgs9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle12TemplateArgs9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13EnclosingExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13EnclosingExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13EnclosingExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13FunctionParam9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13FunctionParam9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13FunctionParam9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13NodeArrayNode9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13NodeArrayNode9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13NodeArrayNode9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ObjCProtoName12isObjCObjectEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ObjCProtoName12isObjCObjectEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ObjCProtoName12isObjCObjectEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ObjCProtoName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ObjCProtoName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ObjCProtoName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack12hasArraySlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack12hasArraySlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack12hasArraySlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack13getSyntaxNodeERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack13getSyntaxNodeERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack13getSyntaxNodeERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack15hasFunctionSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack15hasFunctionSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack15hasFunctionSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack23initializePackExpansionERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack23initializePackExpansionERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack23initializePackExpansionERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ParameterPack9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13QualifiedName11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle13QualifiedName11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13QualifiedName11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13QualifiedName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13QualifiedName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13QualifiedName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType8collapseERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType8collapseERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType8collapseERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle13ReferenceType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14ConversionExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle14ConversionExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14ConversionExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14IntegerLiteral9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle14IntegerLiteral9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14IntegerLiteral9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE4sizeEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE4sizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE4sizeEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE8isInlineEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE8isInlineEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_24ForwardTemplateReferenceELm4EE8isInlineEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE4sizeEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE4sizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE4sizeEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE5emptyEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE5emptyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE5emptyEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8isInlineEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8isInlineEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm32EE8isInlineEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE4sizeEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE4sizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE4sizeEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE8isInlineEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE8isInlineEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle14PODSmallVectorIPNS0_4NodeELm8EE8isInlineEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle15BracedRangeExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle15BracedRangeExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle15BracedRangeExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle15ClosureTypeName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle15ClosureTypeName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle15ClosureTypeName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle15ConditionalExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle15ConditionalExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle15ConditionalExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle15IntegerCastExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle15IntegerCastExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle15IntegerCastExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle15LiteralOperator9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle15LiteralOperator9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle15LiteralOperator9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle15PixelVectorType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle15PixelVectorType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle15PixelVectorType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle15UnnamedTypeName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle15UnnamedTypeName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle15UnnamedTypeName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdE9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdE9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIdE9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeE9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeE9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIeE9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfE9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfE9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16FloatLiteralImplIfE9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding15hasFunctionSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding15hasFunctionSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding15hasFunctionSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16FunctionEncoding9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16StdQualifiedName11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle16StdQualifiedName11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16StdQualifiedName11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle16StdQualifiedName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle16StdQualifiedName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle16StdQualifiedName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle17VendorExtQualType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle17VendorExtQualType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle17VendorExtQualType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle18ArraySubscriptExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle18ArraySubscriptExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle18ArraySubscriptExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle19GlobalQualifiedName11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle19GlobalQualifiedName11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle19GlobalQualifiedName11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle19GlobalQualifiedName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle19GlobalQualifiedName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle19GlobalQualifiedName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle19PointerToMemberType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle19SizeofParamPackExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle19SizeofParamPackExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle19SizeofParamPackExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle19SpecialSubstitution11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle19SpecialSubstitution11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle19SpecialSubstitution11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle19SpecialSubstitution9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle19SpecialSubstitution9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle19SpecialSubstitution9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpec9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpec9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle20DynamicExceptionSpec9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgs11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgs11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgs11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgs9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgs9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle20NameWithTemplateArgs9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle20PostfixQualifiedType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle20PostfixQualifiedType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle20PostfixQualifiedType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle20TemplateArgumentPack11getElementsEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle20TemplateArgumentPack11getElementsEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle20TemplateArgumentPack11getElementsEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle20TemplateArgumentPack9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle20TemplateArgumentPack9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle20TemplateArgumentPack9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle21CtorVtableSpecialName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle21StructuredBindingName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle21StructuredBindingName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle21StructuredBindingName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E7numLeftEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E7numLeftEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E7numLeftEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle22ConversionOperatorType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle22ConversionOperatorType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle22ConversionOperatorType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle22ElaboratedTypeSpefType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle22ParameterPackExpansion9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle22ParameterPackExpansion9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle22ParameterPackExpansion9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference12hasArraySlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference12hasArraySlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference12hasArraySlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference13getSyntaxNodeERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference13getSyntaxNodeERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference13getSyntaxNodeERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference15hasFunctionSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference15hasFunctionSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference15hasFunctionSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle24ForwardTemplateReference9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitution11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitution11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitution11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitution9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitution9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle27ExpandedSpecialSubstitution9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node11hasFunctionERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node11hasFunctionERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node11hasFunctionERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node12hasArraySlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node12hasArraySlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node12hasArraySlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node13getSyntaxNodeERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node13getSyntaxNodeERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node13getSyntaxNodeERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node15hasFunctionSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node15hasFunctionSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node15hasFunctionSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node15hasRHSComponentERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node15hasRHSComponentERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node15hasRHSComponentERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node5printERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node5printERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node5printERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node7getKindEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node7getKindEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node7getKindEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle4Node8hasArrayERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle4Node8hasArrayERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle4Node8hasArrayERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle7NewExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle7NewExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle7NewExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8BoolExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8BoolExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8BoolExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8CallExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8CallExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8CallExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8CastExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8CastExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8CastExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8DtorName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8DtorName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8DtorName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8FoldExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8FoldExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8FoldExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8NameType11getBaseNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle8NameType11getBaseNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8NameType11getBaseNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8NameType7getNameEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle8NameType7getNameEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8NameType7getNameEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8NameType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8NameType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8NameType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8QualType10printQualsERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8QualType10printQualsERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8QualType10printQualsERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8QualType10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8QualType10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8QualType10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8QualType12hasArraySlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8QualType12hasArraySlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8QualType12hasArraySlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8QualType15hasFunctionSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8QualType15hasFunctionSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8QualType15hasFunctionSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8QualType19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8QualType19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8QualType19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle8QualType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle8QualType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle8QualType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9ArrayType10printRightERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle9ArrayType10printRightERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9ArrayType10printRightERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9ArrayType12hasArraySlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle9ArrayType12hasArraySlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9ArrayType12hasArraySlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9ArrayType19hasRHSComponentSlowERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle9ArrayType19hasRHSComponentSlowERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9ArrayType19hasRHSComponentSlowERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9ArrayType9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle9ArrayType9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9ArrayType9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9DotSuffix9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle9DotSuffix9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9DotSuffix9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9LocalName9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle9LocalName9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9LocalName9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9NodeArray14printWithCommaERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray14printWithCommaERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray14printWithCommaERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9NodeArray3endEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray3endEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray3endEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9NodeArray4sizeEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray4sizeEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray4sizeEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9NodeArray5beginEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray5beginEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray5beginEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9NodeArray5emptyEv = Module["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray5emptyEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArray5emptyEv"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9NodeArrayixEm = Module["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArrayixEm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9NodeArrayixEm"].apply(null, arguments)
};

var __ZNK12_GLOBAL__N_116itanium_demangle9ThrowExpr9printLeftERNS_12OutputStreamE = Module["__ZNK12_GLOBAL__N_116itanium_demangle9ThrowExpr9printLeftERNS_12OutputStreamE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNK12_GLOBAL__N_116itanium_demangle9ThrowExpr9printLeftERNS_12OutputStreamE"].apply(null, arguments)
};

var __ZNKSt3__212_GLOBAL__N_114initial_stringINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEiLb0EEclEv = Module["__ZNKSt3__212_GLOBAL__N_114initial_stringINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEiLb0EEclEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__212_GLOBAL__N_114initial_stringINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEiLb0EEclEv"].apply(null, arguments)
};

var __ZNKSt3__221__basic_string_commonILb1EE20__throw_length_errorEv = Module["__ZNKSt3__221__basic_string_commonILb1EE20__throw_length_errorEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNKSt3__221__basic_string_commonILb1EE20__throw_length_errorEv"].apply(null, arguments)
};

var __ZNSt3__211char_traitsIcE11to_int_typeEc = Module["__ZNSt3__211char_traitsIcE11to_int_typeEc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__211char_traitsIcE11to_int_typeEc"].apply(null, arguments)
};

var __ZNSt3__211char_traitsIcE4copyEPcPKcm = Module["__ZNSt3__211char_traitsIcE4copyEPcPKcm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__211char_traitsIcE4copyEPcPKcm"].apply(null, arguments)
};

var __ZNSt3__211char_traitsIcE6assignEPcmc = Module["__ZNSt3__211char_traitsIcE6assignEPcmc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__211char_traitsIcE6assignEPcmc"].apply(null, arguments)
};

var __ZNSt3__211char_traitsIcE6assignERcRKc = Module["__ZNSt3__211char_traitsIcE6assignERcRKc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__211char_traitsIcE6assignERcRKc"].apply(null, arguments)
};

var __ZNSt3__212_GLOBAL__N_19as_stringINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPFiPcmPKczEiEET_T0_SD_PKNSD_10value_typeET1_ = Module["__ZNSt3__212_GLOBAL__N_19as_stringINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPFiPcmPKczEiEET_T0_SD_PKNSD_10value_typeET1_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__212_GLOBAL__N_19as_stringINS_12basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEEEPFiPcmPKczEiEET_T0_SD_PKNSD_10value_typeET1_"].apply(null, arguments)
};

var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEmc = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEmc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEmc"].apply(null, arguments)
};

var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6resizeEmc = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6resizeEmc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6resizeEmc"].apply(null, arguments)
};

var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm"].apply(null, arguments)
};

var __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev = Module["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev"].apply(null, arguments)
};

var __ZNSt3__217_DeallocateCaller27__do_deallocate_handle_sizeEPvm = Module["__ZNSt3__217_DeallocateCaller27__do_deallocate_handle_sizeEPvm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__217_DeallocateCaller27__do_deallocate_handle_sizeEPvm"].apply(null, arguments)
};

var __ZNSt3__217_DeallocateCaller9__do_callEPv = Module["__ZNSt3__217_DeallocateCaller9__do_callEPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__217_DeallocateCaller9__do_callEPv"].apply(null, arguments)
};

var __ZNSt3__29to_stringEi = Module["__ZNSt3__29to_stringEi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt3__29to_stringEi"].apply(null, arguments)
};

var __ZNSt9type_infoD2Ev = Module["__ZNSt9type_infoD2Ev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZNSt9type_infoD2Ev"].apply(null, arguments)
};

var __ZSt11__terminatePFvvE = Module["__ZSt11__terminatePFvvE"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZSt11__terminatePFvvE"].apply(null, arguments)
};

var __ZSt13get_terminatev = Module["__ZSt13get_terminatev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZSt13get_terminatev"].apply(null, arguments)
};

var __ZSt15get_new_handlerv = Module["__ZSt15get_new_handlerv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZSt15get_new_handlerv"].apply(null, arguments)
};

var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZSt18uncaught_exceptionv"].apply(null, arguments)
};

var __ZSt19uncaught_exceptionsv = Module["__ZSt19uncaught_exceptionsv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZSt19uncaught_exceptionsv"].apply(null, arguments)
};

var __ZSt9terminatev = Module["__ZSt9terminatev"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZSt9terminatev"].apply(null, arguments)
};

var __ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE0_clES4_ = Module["__ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE0_clES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE0_clES4_"].apply(null, arguments)
};

var __ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE1_clES4_ = Module["__ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE1_clES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE1_clES4_"].apply(null, arguments)
};

var __ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE_clES4_ = Module["__ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE_clES4_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN12_GLOBAL__N_116itanium_demangle13ParameterPackC1ENS0_9NodeArrayEENKUlPNS0_4NodeEE_clES4_"].apply(null, arguments)
};

var __ZZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseEncodingEvENKUlvE_clEv = Module["__ZZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseEncodingEvENKUlvE_clEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E13parseEncodingEvENKUlvE_clEv"].apply(null, arguments)
};

var __ZZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseNestedNameEPNS5_9NameStateEENKUlPNS0_4NodeEE_clES9_ = Module["__ZZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseNestedNameEPNS5_9NameStateEENKUlPNS0_4NodeEE_clES9_"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZN12_GLOBAL__N_116itanium_demangle22AbstractManglingParserINS0_14ManglingParserINS_16DefaultAllocatorEEES3_E15parseNestedNameEPNS5_9NameStateEENKUlPNS0_4NodeEE_clES9_"].apply(null, arguments)
};

var __ZZNK12_GLOBAL__N_116itanium_demangle8FoldExpr9printLeftERNS_12OutputStreamEENKUlvE_clEv = Module["__ZZNK12_GLOBAL__N_116itanium_demangle8FoldExpr9printLeftERNS_12OutputStreamEENKUlvE_clEv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZZNK12_GLOBAL__N_116itanium_demangle8FoldExpr9printLeftERNS_12OutputStreamEENKUlvE_clEv"].apply(null, arguments)
};

var __ZdlPv = Module["__ZdlPv"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__ZdlPv"].apply(null, arguments)
};

var __Znwm = Module["__Znwm"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["__Znwm"].apply(null, arguments)
};

var ___DOUBLE_BITS_548 = Module["___DOUBLE_BITS_548"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___DOUBLE_BITS_548"].apply(null, arguments)
};

var ___DOUBLE_BITS_662 = Module["___DOUBLE_BITS_662"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___DOUBLE_BITS_662"].apply(null, arguments)
};

var ___clang_call_terminate = Module["___clang_call_terminate"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___clang_call_terminate"].apply(null, arguments)
};

var ___cxa_can_catch = Module["___cxa_can_catch"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_can_catch"].apply(null, arguments)
};

var ___cxa_demangle = Module["___cxa_demangle"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_demangle"].apply(null, arguments)
};

var ___cxa_get_globals_fast = Module["___cxa_get_globals_fast"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_get_globals_fast"].apply(null, arguments)
};

var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxa_is_pointer_type"].apply(null, arguments)
};

var ___cxx_global_var_init = Module["___cxx_global_var_init"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxx_global_var_init"].apply(null, arguments)
};

var ___cxx_global_var_init_71 = Module["___cxx_global_var_init_71"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___cxx_global_var_init_71"].apply(null, arguments)
};

var ___dynamic_cast = Module["___dynamic_cast"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___dynamic_cast"].apply(null, arguments)
};

var ___embind_register_native_and_builtin_types = Module["___embind_register_native_and_builtin_types"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___embind_register_native_and_builtin_types"].apply(null, arguments)
};

var ___errno_location = Module["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___errno_location"].apply(null, arguments)
};

var ___fflush_unlocked = Module["___fflush_unlocked"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___fflush_unlocked"].apply(null, arguments)
};

var ___floatscan = Module["___floatscan"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___floatscan"].apply(null, arguments)
};

var ___fwritex = Module["___fwritex"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___fwritex"].apply(null, arguments)
};

var ___getTypeName = Module["___getTypeName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___getTypeName"].apply(null, arguments)
};

var ___lockfile = Module["___lockfile"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___lockfile"].apply(null, arguments)
};

var ___muldi3 = Module["___muldi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___muldi3"].apply(null, arguments)
};

var ___muldsi3 = Module["___muldsi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___muldsi3"].apply(null, arguments)
};

var ___ofl_lock = Module["___ofl_lock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___ofl_lock"].apply(null, arguments)
};

var ___ofl_unlock = Module["___ofl_unlock"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___ofl_unlock"].apply(null, arguments)
};

var ___overflow = Module["___overflow"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___overflow"].apply(null, arguments)
};

var ___pthread_self_896 = Module["___pthread_self_896"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___pthread_self_896"].apply(null, arguments)
};

var ___shgetc = Module["___shgetc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___shgetc"].apply(null, arguments)
};

var ___shlim = Module["___shlim"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___shlim"].apply(null, arguments)
};

var ___stdio_close = Module["___stdio_close"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stdio_close"].apply(null, arguments)
};

var ___stdio_seek = Module["___stdio_seek"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stdio_seek"].apply(null, arguments)
};

var ___stdio_write = Module["___stdio_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stdio_write"].apply(null, arguments)
};

var ___stdout_write = Module["___stdout_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stdout_write"].apply(null, arguments)
};

var ___stpcpy = Module["___stpcpy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___stpcpy"].apply(null, arguments)
};

var ___strdup = Module["___strdup"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___strdup"].apply(null, arguments)
};

var ___syscall_ret = Module["___syscall_ret"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___syscall_ret"].apply(null, arguments)
};

var ___toread = Module["___toread"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___toread"].apply(null, arguments)
};

var ___towrite = Module["___towrite"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___towrite"].apply(null, arguments)
};

var ___udivdi3 = Module["___udivdi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___udivdi3"].apply(null, arguments)
};

var ___udivmoddi4 = Module["___udivmoddi4"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___udivmoddi4"].apply(null, arguments)
};

var ___uflow = Module["___uflow"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___uflow"].apply(null, arguments)
};

var ___unlockfile = Module["___unlockfile"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___unlockfile"].apply(null, arguments)
};

var ___vfprintf_internal = Module["___vfprintf_internal"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["___vfprintf_internal"].apply(null, arguments)
};

var _abort_message = Module["_abort_message"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_abort_message"].apply(null, arguments)
};

var _atof = Module["_atof"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_atof"].apply(null, arguments)
};

var _atoi = Module["_atoi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_atoi"].apply(null, arguments)
};

var _bitshift64Lshr = Module["_bitshift64Lshr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_bitshift64Lshr"].apply(null, arguments)
};

var _bitshift64Shl = Module["_bitshift64Shl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_bitshift64Shl"].apply(null, arguments)
};

var _copysign = Module["_copysign"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_copysign"].apply(null, arguments)
};

var _copysignl = Module["_copysignl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_copysignl"].apply(null, arguments)
};

var _crop = Module["_crop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_crop"].apply(null, arguments)
};

var _decfloat = Module["_decfloat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_decfloat"].apply(null, arguments)
};

var _detect = Module["_detect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_detect"].apply(null, arguments)
};

var _dispose_chunk = Module["_dispose_chunk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_dispose_chunk"].apply(null, arguments)
};

var _dummy = Module["_dummy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_dummy"].apply(null, arguments)
};

var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments)
};

var _end = Module["_end"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_end"].apply(null, arguments)
};

var _fflush = Module["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fflush"].apply(null, arguments)
};

var _fmod = Module["_fmod"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fmod"].apply(null, arguments)
};

var _fmodl = Module["_fmodl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fmodl"].apply(null, arguments)
};

var _fmt_fp = Module["_fmt_fp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fmt_fp"].apply(null, arguments)
};

var _fmt_o = Module["_fmt_o"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fmt_o"].apply(null, arguments)
};

var _fmt_u = Module["_fmt_u"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fmt_u"].apply(null, arguments)
};

var _fmt_x = Module["_fmt_x"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fmt_x"].apply(null, arguments)
};

var _fputc = Module["_fputc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_fputc"].apply(null, arguments)
};

var _free = Module["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_free"].apply(null, arguments)
};

var _frexp = Module["_frexp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_frexp"].apply(null, arguments)
};

var _getBytes = Module["_getBytes"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_getBytes"].apply(null, arguments)
};

var _getint_654 = Module["_getint_654"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_getint_654"].apply(null, arguments)
};

var _hexfloat = Module["_hexfloat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_hexfloat"].apply(null, arguments)
};

var _i64Add = Module["_i64Add"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_i64Add"].apply(null, arguments)
};

var _i64Subtract = Module["_i64Subtract"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_i64Subtract"].apply(null, arguments)
};

var _initialize = Module["_initialize"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_initialize"].apply(null, arguments)
};

var _isdigit = Module["_isdigit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_isdigit"].apply(null, arguments)
};

var _islower = Module["_islower"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_islower"].apply(null, arguments)
};

var _isspace = Module["_isspace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_isspace"].apply(null, arguments)
};

var _isxdigit = Module["_isxdigit"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_isxdigit"].apply(null, arguments)
};

var _malloc = Module["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_malloc"].apply(null, arguments)
};

var _memchr = Module["_memchr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memchr"].apply(null, arguments)
};

var _memcpy = Module["_memcpy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memcpy"].apply(null, arguments)
};

var _memmove = Module["_memmove"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memmove"].apply(null, arguments)
};

var _memset = Module["_memset"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_memset"].apply(null, arguments)
};

var _onCroppped = Module["_onCroppped"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_onCroppped"].apply(null, arguments)
};

var _onDetected = Module["_onDetected"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_onDetected"].apply(null, arguments)
};

var _onInitialized = Module["_onInitialized"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_onInitialized"].apply(null, arguments)
};

var _out_653 = Module["_out_653"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_out_653"].apply(null, arguments)
};

var _pad_659 = Module["_pad_659"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pad_659"].apply(null, arguments)
};

var _pop_arg_656 = Module["_pop_arg_656"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pop_arg_656"].apply(null, arguments)
};

var _pop_arg_long_double = Module["_pop_arg_long_double"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pop_arg_long_double"].apply(null, arguments)
};

var _printf_core = Module["_printf_core"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_printf_core"].apply(null, arguments)
};

var _pthread_self = Module["_pthread_self"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_pthread_self"].apply(null, arguments)
};

var _realloc = Module["_realloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_realloc"].apply(null, arguments)
};

var _release = Module["_release"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_release"].apply(null, arguments)
};

var _resetCrop = Module["_resetCrop"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_resetCrop"].apply(null, arguments)
};

var _resetDetect = Module["_resetDetect"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_resetDetect"].apply(null, arguments)
};

var _sbrk = Module["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sbrk"].apply(null, arguments)
};

var _scalbn = Module["_scalbn"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_scalbn"].apply(null, arguments)
};

var _scalbnl = Module["_scalbnl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_scalbnl"].apply(null, arguments)
};

var _scanexp = Module["_scanexp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_scanexp"].apply(null, arguments)
};

var _sn_write = Module["_sn_write"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_sn_write"].apply(null, arguments)
};

var _snprintf = Module["_snprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_snprintf"].apply(null, arguments)
};

var _start = Module["_start"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_start"].apply(null, arguments)
};

var _strcat = Module["_strcat"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_strcat"].apply(null, arguments)
};

var _strcmp = Module["_strcmp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_strcmp"].apply(null, arguments)
};

var _strcpy = Module["_strcpy"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_strcpy"].apply(null, arguments)
};

var _strlen = Module["_strlen"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_strlen"].apply(null, arguments)
};

var _strtod = Module["_strtod"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_strtod"].apply(null, arguments)
};

var _strtox_806 = Module["_strtox_806"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_strtox_806"].apply(null, arguments)
};

var _try_realloc_chunk = Module["_try_realloc_chunk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_try_realloc_chunk"].apply(null, arguments)
};

var _vfprintf = Module["_vfprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_vfprintf"].apply(null, arguments)
};

var _vsnprintf = Module["_vsnprintf"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_vsnprintf"].apply(null, arguments)
};

var _wcrtomb = Module["_wcrtomb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_wcrtomb"].apply(null, arguments)
};

var _wctomb = Module["_wctomb"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["_wctomb"].apply(null, arguments)
};

var establishStackSpace = Module["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["establishStackSpace"].apply(null, arguments)
};

var globalCtors = Module["globalCtors"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["globalCtors"].apply(null, arguments)
};

var stackAlloc = Module["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackAlloc"].apply(null, arguments)
};

var stackRestore = Module["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackRestore"].apply(null, arguments)
};

var stackSave = Module["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["stackSave"].apply(null, arguments)
};

var dynCall_ii = Module["dynCall_ii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_ii"].apply(null, arguments)
};

var dynCall_iidiiii = Module["dynCall_iidiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iidiiii"].apply(null, arguments)
};

var dynCall_iii = Module["dynCall_iii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iii"].apply(null, arguments)
};

var dynCall_iiii = Module["dynCall_iiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiii"].apply(null, arguments)
};

var dynCall_iiiii = Module["dynCall_iiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_iiiii"].apply(null, arguments)
};

var dynCall_v = Module["dynCall_v"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_v"].apply(null, arguments)
};

var dynCall_vi = Module["dynCall_vi"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vi"].apply(null, arguments)
};

var dynCall_vii = Module["dynCall_vii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_vii"].apply(null, arguments)
};

var dynCall_viii = Module["dynCall_viii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viii"].apply(null, arguments)
};

var dynCall_viiiff = Module["dynCall_viiiff"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiff"].apply(null, arguments)
};

var dynCall_viiii = Module["dynCall_viiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiii"].apply(null, arguments)
};

var dynCall_viiiii = Module["dynCall_viiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiii"].apply(null, arguments)
};

var dynCall_viiiiii = Module["dynCall_viiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiii"].apply(null, arguments)
};

var dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return Module["asm"]["dynCall_viiiiiiiii"].apply(null, arguments)
};
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Object.getOwnPropertyDescriptor(Module, "intArrayFromString")) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "intArrayToString")) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
if (!Object.getOwnPropertyDescriptor(Module, "setValue")) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["getValue"] = getValue;
if (!Object.getOwnPropertyDescriptor(Module, "allocate")) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getMemory")) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "AsciiToString")) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToAscii")) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ArrayToString")) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF8ToString")) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8Array")) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF8")) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF8")) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF16ToString")) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF16")) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF16")) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "UTF32ToString")) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stringToUTF32")) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "lengthBytesUTF32")) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "allocateUTF8")) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackTrace")) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreRun")) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnInit")) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPreMain")) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnExit")) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addOnPostRun")) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeStringToMemory")) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeArrayToMemory")) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "writeAsciiToMemory")) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "addRunDependency")) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "removeRunDependency")) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "ENV")) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS")) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createFolder")) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPath")) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDataFile")) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createPreloadedFile")) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLazyFile")) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createLink")) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_createDevice")) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "FS_unlink")) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Object.getOwnPropertyDescriptor(Module, "GL")) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynamicAlloc")) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "warnOnce")) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "loadDynamicLibrary")) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "loadWebAssemblyModule")) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getLEB")) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getFunctionTables")) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "alignFunctionTables")) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "registerFunctions")) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["addFunction"] = addFunction;
Module["removeFunction"] = removeFunction;
if (!Object.getOwnPropertyDescriptor(Module, "getFuncWrapper")) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "prettyPrint")) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "makeBigInt")) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "dynCall")) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getCompilerSetting")) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackSave")) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackRestore")) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "stackAlloc")) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "establishStackSpace")) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "print")) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "printErr")) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "getTempRet0")) Module["getTempRet0"] = function() { abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "setTempRet0")) Module["setTempRet0"] = function() { abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "callMain")) Module["callMain"] = function() { abort("'callMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Object.getOwnPropertyDescriptor(Module, "Pointer_stringify")) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NORMAL")) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_STACK")) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_DYNAMIC")) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Object.getOwnPropertyDescriptor(Module, "ALLOC_NONE")) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });




/**
 * @constructor
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}

var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
};





/** @type {function(Array=)} */
function run(args) {
  args = args || arguments_;

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    initRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else
  {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
    warnOnce('(this may also be due to not including full filesystem support - try building with -s FORCE_FILESYSTEM=1)');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('exit(' + status + ') called, but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  quit_(status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  what += '';
  out(what);
  err(what);

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


  Module["noExitRuntime"] = true;

run();





// {{MODULE_ADDITIONS}}







var AcuantPassiveLiveness = (function () {
    var faceCaptureInput = null;
    var onCaptureCallback = null;

    let svc = {
        startSelfieCapture: function (callback) {
            onCaptureCallback = callback;
            if(!faceCaptureInput){
                faceCaptureInput = document.createElement("input");
                faceCaptureInput.type = "file";
                faceCaptureInput.capture = "user";
                faceCaptureInput.accept = "image/*";
                faceCaptureInput.onchange = onCapture;
            }
            faceCaptureInput.click();
        },

        postLiveness: function (request, callback) {
            postPassiveLiveness(request, callback)
        }
    };

    async function postPassiveLiveness(request, callback) {
        const body = {
            "Settings": {
                "SubscriptionId": request.subscriptionId,
                "AdditionalSettings": {
                    "OS": "UNKNOWN"
                }
            },
            "Image": request.image
        }
        const response = await fetch(request.endpoint + '/api/v1/liveness', {
            method: 'POST',
            body: JSON.stringify(body), // string or object
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + request.token,
                'Accept': 'application/json'
            }
        });

        const myJson = await response.json();
        callback(myJson);
    }

    var manualCaptureImage = undefined;
    var manualCaptureCanvas = undefined;

    function onCapture(event) {
        if(!manualCaptureImage){
            manualCaptureImage = document.createElement('img');
        }

        if (!manualCaptureCanvas){
            manualCaptureCanvas = document.createElement('canvas');
        }
        
        let file = event.target,
            reader = new FileReader();

        reader.onload = (e) => {
            manualCaptureImage.onload = () => {                
                let MAX_WIDTH = 1080,
                    MAX_HEIGHT = 720,
                    width = manualCaptureImage.width,
                    height = manualCaptureImage.height,
                    context = manualCaptureCanvas.getContext('2d');

                var smallerDimension = width > height ? height: width;

                if (smallerDimension > MAX_HEIGHT) {
                    if (width < height) {
                        var aspectRatio = height / width;
                        MAX_WIDTH = MAX_HEIGHT;
                        MAX_HEIGHT = MAX_WIDTH * aspectRatio;
                    }
                    else {
                        var aspectRatio = width / height;
                        MAX_WIDTH = MAX_HEIGHT * aspectRatio;
                    }
                } else {
                    MAX_WIDTH = manualCaptureImage.width;
                    MAX_HEIGHT = manualCaptureImage.height;
                }

                manualCaptureCanvas.width = MAX_WIDTH;
                manualCaptureCanvas.height = MAX_HEIGHT;

                context.drawImage(manualCaptureImage, 0, 0, MAX_WIDTH, MAX_HEIGHT);
                let data = manualCaptureCanvas.toDataURL('image/jpeg', 0.8);
                let output = data.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                context.clearRect(0, 0, MAX_WIDTH, MAX_HEIGHT);

                onCaptureCallback(output);
            }
            manualCaptureImage.src = e.target.result;
        }
        reader.readAsDataURL(file.files[0]);
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
    return svc;

})();