// eslint-disable-next-line no-unused-vars, no-var
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
  };

  let userOptions = {
    text: {
      NONE: 'ALIGN',
      SMALL_DOCUMENT: 'MOVE CLOSER',
      GOOD_DOCUMENT: null,
      BIG_DOCUMENT: 'TOO CLOSE',
      CAPTURING: 'CAPTURING',
      TAP_TO_CAPTURE: 'TAP TO CAPTURE'
    }
  };

  const TRIGGER_TIME = 3000;
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
      acuantCamera.removeEventListener('acuantcameracreated', onAcuantCameraCreated);
    }
    if (uiCanvas) {
      uiCanvas.removeEventListener('click', onTap);
      uiCanvas.getContext('2d').clearRect(0, 0, uiCanvas.width, uiCanvas.height);
    }
    AcuantCamera.end();
  }

  function start(captureCb, errorCb, options) {
    errorCallback = errorCb;
    if (options) {
      userOptions = options;
      // eslint-disable-next-line no-prototype-builtins
      if (!userOptions.text.hasOwnProperty('BIG_DOCUMENT')) {
        userOptions.text.BIG_DOCUMENT = 'TOO CLOSE';
      }
    }
    if (AcuantCamera.isCameraSupported) {
      if (!isStarted) {
        isStarted = true;
        reset();
        startCamera(captureCb);
      } 
    }
    else {
      onError('Camera not supported.', AcuantJavascriptWebSdk.START_FAIL_CODE);
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
      return minTime < DETECT_TIME_THRESHOLD;
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
        capture(captureCb, 'AUTO');
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
    capture(event.currentTarget.callback, 'TAP');
  }

  function onAcuantCameraCreated() {
    player = document.getElementById('acuant-player');
    uiCanvas = document.getElementById('acuant-ui-canvas');
    uiContext = uiCanvas.getContext('2d');

    uiCanvas.setAttribute('role', 'img');
    player.addEventListener('play', play, 0);
  }

  function startCamera(captureCb) {
    let count = 0;
    let startTime = new Date().getTime();

    acuantCamera = document.getElementById('acuant-camera');
    if (acuantCamera) {
      acuantCamera.addEventListener('acuantcameracreated', onAcuantCameraCreated);
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
        });
      }
      else {
        captureCb.onCaptured(response);
      }

      AcuantCamera.evaluateImage(response.data, response.width, response.height, response.isPortraitOrientation, capType, (result) => {
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

  function drawText(text, fontWeight = 0.04, color = '#ffffff', showBackRect = true) {
    let dimension = getDimension();
    let currentOrientation = window.orientation;
    let measured = uiContext.measureText(text);

    let offsetY = (Math.max(dimension.width, dimension.height) * 0.01);
    let offsetX = (Math.max(dimension.width, dimension.height) * 0.02);

    let x = (dimension.height - offsetX - measured.width) / 2;
    let y = -((dimension.width / 2) - offsetY);
    let rotation = 90;

    if (currentOrientation !== 0) {
      rotation = 0;
      x = (dimension.width - offsetY - measured.width) / 2;
      y = (dimension.height / 2) - offsetX + (Math.max(dimension.width, dimension.height) * 0.04);
    }

    uiContext.rotate(rotation * Math.PI / 180);

    if (showBackRect) {
      uiContext.fillStyle = 'rgba(0, 0, 0, 0.5)';
      uiContext.fillRect(
        Math.round(x - offsetY),
        Math.round(y + offsetY),
        Math.round(measured.width + offsetX),
        -Math.round((Math.max(dimension.width, dimension.height) * 0.05))
      );
    }

    uiContext.font = (Math.ceil(Math.max(dimension.width, dimension.height) * fontWeight) || 0) + 'px Sans-serif';
    uiContext.fillStyle = color;
    uiContext.fillText(text, x, y);
    updateUiStateTextElement(text);

    // undo rotation to keep the ui in the same position
    uiContext.rotate(-(rotation * Math.PI / 180));
  }

  // For screen readers
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
  };

  function getDimension() {
    return {
      height: uiCanvas.height,
      width: uiCanvas.width
    };
  }

  function drawCorners(point, index) {
    let currentOrientation = window.orientation;
    let dimension = getDimension();
    let offsetX = dimension.width * 0.08;
    let offsetY = dimension.height * 0.07;

    if (currentOrientation !== 0) {
      offsetX = dimension.width * 0.07;
      offsetY = dimension.height * 0.08;
    }

    switch (index.toString()) {
    case '1':
      offsetX = -offsetX;
      break;
    case '2':
      offsetX = -offsetX;
      offsetY = -offsetY;
      break;
    case '3':
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
      drawPoints('#000000');
      drawText(userOptions.text.NONE);
    } else if (onDetectedResult.state === UI_STATE.CAPTURING) {
      drawPoints('#00ff00');
      drawOverlay('rgba(0, 255, 0, 0.2)');
      drawText(userOptions.text.CAPTURING, 0.05, '#00ff00', false);
    } else if (onDetectedResult.state === UI_STATE.TAP_TO_CAPTURE) {
      drawPoints('#000000');
      drawText(userOptions.text.TAP_TO_CAPTURE);
    } else if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT) {
      drawPoints('#ffff00');
      drawOverlay('rgba(255, 255, 0, 0.2)');

      if (userOptions.text.GOOD_DOCUMENT) {
        drawText(userOptions.text.GOOD_DOCUMENT, 0.09, '#ff0000', false);
      } else {
        let diff = Math.ceil((TRIGGER_TIME - (new Date().getTime() - counter)) / 1000);
        if (diff <= 0) {
          diff = 1;
        }
        drawText(diff + '...', 0.09, '#ff0000', false);
      }

    } else if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.SMALL_DOCUMENT) {
      drawPoints('#ff0000');
      drawText(userOptions.text.SMALL_DOCUMENT);
    } else if (onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.BIG_DOCUMENT) {
      drawPoints('#ff0000');
      drawText(userOptions.text.BIG_DOCUMENT);
    } else {
      drawPoints('#000000');
      drawText(userOptions.text.NONE);
    }
  }

  function drawOverlay(style) {
    if (onDetectedResult && onDetectedResult.points && onDetectedResult.points.length === 4) {
      uiContext.beginPath();

      uiContext.moveTo(Math.round(onDetectedResult.points[0].x), Math.round(onDetectedResult.points[0].y));

      for (let i = 1; i < onDetectedResult.points.length; i++) {
        uiContext.lineTo(Math.round(onDetectedResult.points[i].x), Math.round(onDetectedResult.points[i].y));
      }
      uiContext.fillStyle = style;
      uiContext.strokeStyle = 'rgba(0, 0, 0, 0)';
      uiContext.stroke();
      uiContext.fill();
    }
  }

  function drawCorner(point, offsetX, offsetY) {
    uiContext.beginPath();
    const roundedX  = Math.round(point.x);
    const roundedY = Math.round(point.y);
    uiContext.moveTo(roundedX, roundedY);
    uiContext.lineTo(Math.round(roundedX + offsetX), roundedY);
    uiContext.moveTo(roundedX, roundedY);
    uiContext.lineTo(roundedX, Math.round(roundedY + offsetY));
    uiContext.stroke();
  }

  function drawPoints(fillStyle) {
    let dimension = getDimension();
    uiContext.lineWidth = (Math.ceil(Math.max(dimension.width, dimension.height) * 0.0025) || 1);
    uiContext.strokeStyle = fillStyle;
    if (onDetectedResult && onDetectedResult.points && (onDetectedResult.state === -1 || onDetectedResult.state === AcuantCamera.DOCUMENT_STATE.GOOD_DOCUMENT)) {
      for (let i in onDetectedResult.points) {
        drawCorners(onDetectedResult.points[i], i);
      }
    } else {
      let center = {
        x: dimension.width / 2,
        y: dimension.height / 2
      };

      let offsetX, offsetY;
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

/* eslint no-undef: 0 */
// eslint-disable-next-line no-unused-vars, no-var
var AcuantCamera = (function () {
  'use strict';
  let player = null;
  let uiCanvas = null;
  let uiContext = null;
  let manualCaptureInput = null;
  let hiddenCanvas = null;
  let hiddenContext = null;

  const SEQUENCE_BREAK_IOS_15 = 'Camera capture failed due to unexpected sequence break. This usually indicates the camera closed or froze unexpectedly. In iOS 15+ this is intermittently occurs due to a GPU Highwater failure. Swap to manual capture until the user fully reloads the browser. Attempting to continue to use live capture can lead to further Highwater errors and can cause to OS to cut off the webpage.';

  const SEQUENCE_BREAK_OTHER = 'Camera capture failed due to unexpected sequence break. This usually indicates the camera closed or froze unexpectedly. Swap to manual capture until the user fully reloads the browser.';

  const DOCUMENT_STATE = {
    NO_DOCUMENT: 0,
    SMALL_DOCUMENT: 1,
    BIG_DOCUMENT: 2,
    GOOD_DOCUMENT: 3
  };

  const ACUANT_DOCUMENT_TYPE = {
    NONE: 0,
    ID: 1,
    PASSPORT: 2
  };

  const TARGET_LONGSIDE_SCALE = 700;
  const TARGET_SHORTSIDE_SCALE = 500;
  const MAX_VIDEO_WIDTH_IOS = 1920;

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
    setRepeatFrameProcessor: processFrameForDetection,
    evaluateImage: evaluateImage
  };
    
  function webViewCheck() {
    const standalone = window.navigator.standalone,
      userAgent = window.navigator.userAgent.toLowerCase(),
      safari = /safari/.test( userAgent ),
      ios = /iphone|ipod|ipad/.test( userAgent );
    
    return (ios && !safari && !standalone);
  }

  function isFireFox(){
    return navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  }

  function checkIOSVersion() {
    return iOSversion()[0] >= 13;
  }

  function mobileCheck() {
    let check = false;
    // eslint-disable-next-line no-useless-escape
    (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);  
    return (check || isIOS()) && (!isFireFox());
  }

  function isIOS() {
    return ((/iPad|iPhone|iPod/.test(navigator.platform) && checkIOSVersion()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  }

  function isSamsungNote10OrS10OrNewer() {
    const matchedModelNumber = navigator.userAgent.match(/SM-[N|G]\d{3}/);
    if (!matchedModelNumber) {
      return false;
    }

    const modelNumber = parseInt(matchedModelNumber[0].match(/\d{3}/)[0], 10);
    const smallerModelNumber = 970; // S10e
    return !isNaN(modelNumber) && modelNumber >= smallerModelNumber;
  }

  const userConfig = getUserConfig();

  function getUserConfig() {
    let config = {
      frameScale: 1,
      primaryConstraints: {
        video: {
          facingMode: { exact: 'environment' },
          //1.3333 aspect ratio and lower ideal height seems to result in better focus and higher dpi on ios devices.
          // I believe this is because the true ratio of the camera is 4:3 so this ratio means people do not need to get as close
          // to the id to get good dpi. Cameras might struggle to focus at very close angles.
          aspectRatio: 4 / 3,
          resizeMode: 'none',

          //This might help performance, especially on low end devices. Might be less important after apple fixes the ios 15 bug,
          // but right now we want to do as little redraws as possible to avoid GPU load.
          //20221110 update removing this as this did not seem to be relevant and might be negatively affecting firefox
          //frameRate: { min: 10, ideal: 15, max: 15 }
        }
      },
      fixedHeight: null,
      fixedWidth: null,
    };

    if (isIOS()) {
      if (isDeviceAffectedByIOS16Issue()) {
        // ios devices dont support zoom, because why would they?!
        // config.primaryConstraints.video.zoom = 2;
        //need to instead bump resolution since we will be capturing from further away, ios 16 seems to have fixed the issue so hopefully alright.
        //also change aspect ratio to make it seem like the id is closer from user's pov.
        config.primaryConstraints.video.aspectRatio = Math.max(window.innerWidth, window.innerHeight) * 1.0 / Math.min(window.innerWidth, window.innerHeight);
        //unsure about the stability of pushing resolution this high, but I have not seen a crash thus far
        config.primaryConstraints.video.height = { min: 1440, ideal: 2880 };
      } else {
        if (isiOS15()) {
          config.primaryConstraints.video.width = { min: MAX_VIDEO_WIDTH_IOS, ideal: MAX_VIDEO_WIDTH_IOS };
        } else {
          config.primaryConstraints.video.height = { min: 1440, ideal: 1440 };
        }
      }
    } else {
      config.primaryConstraints.video.height = { min: 1440, ideal: 1440 };
      if (isSamsungNote10OrS10OrNewer()) {
        //We found out that some triple camera Samsung devices (S10, S20, Note 20, etc) capture images blurry at edges.
        //Zooming to 2X, matching the telephoto lens, doesn't solve it completely but mitigates it.
        config.primaryConstraints.video.zoom = 2.0;
      }
    } 

    return config;
  }

  function enableCamera(stream){
    isStarted = true;
    player.srcObject = stream;
    addEvents();
    player.play();
  }

  function callCameraError(error, code) {
    document.cookie = 'AcuantCameraHasFailed=' + code;
    endCamera();
    if (onErrorCallback && typeof (onErrorCallback) === 'function') {
      if (document.fullscreenElement) {
        document.exitFullscreen().then(() => {
          onErrorCallback(error, code);
        });
      }
      else {
        onErrorCallback(error, code);
      }
    } else {
      console.error('No error callback set. Review implementation.');
      console.error(error, code);
    }
  }


  function isBackCameraLabel(cameraLabel) {
    const backCameraKeywords = [
      'rear',
      'back',
      'rück',
      'arrière',
      'trasera',
      'trás',
      'traseira',
      'posteriore',
      '后面',
      '後面',
      '背面',
      'задней',
      'الخلفية',
      '후',
      'arka',
      'achterzijde',
      'หลัง',
      'baksidan',
      'bagside',
      'sau',
      'bak',
      'tylny',
      'takakamera',
      'belakang',
      'אחורית',
      'πίσω',
      'spate',
      'hátsó',
      'zadní',
      'darrere',
      'zadná',
      'задня',
      'stražnja',
      'belakang',
      'बैक'
    ];
    return backCameraKeywords.some((keyword) => {
      return cameraLabel.includes(keyword);
    });
  }

  //sets up constraints to target the best camera. I think this is what the original implementer went off of:
  //https://old.reddit.com/r/javascript/comments/8eg8w5/choosing_cameras_in_javascript_with_the/
  //could be prone to error
  function getDevice() {
    return new Promise((resolve) => {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          const minSuffixDevice = {
            suffix: undefined,
            device: undefined,
          };
          const dualWideCamera = devices.find(d => d.label === 'Back Dual Wide Camera');
          if (isiOS164Plus() && dualWideCamera) {
            minSuffixDevice.device = dualWideCamera;
          } else {
            devices
              .filter(device => device.kind === 'videoinput')
              .forEach(device => {
                if (isBackCameraLabel(device.label)) {
                  let split = device.label.split(',');
                  let cameraSuffixNumber = parseInt(split[0][split[0].length -1]);

                  if (cameraSuffixNumber || cameraSuffixNumber === 0) {
                    if (minSuffixDevice.suffix === undefined || minSuffixDevice.suffix > cameraSuffixNumber) {
                      minSuffixDevice.suffix = cameraSuffixNumber;
                      minSuffixDevice.device = device;
                    }
                  }
                }
              });
          }
          resolve(minSuffixDevice.device);
        })
        .catch(() => {
          resolve();
        });
    });        
  }

  function startCamera(constraints, iteration = 0) {
    const MAX_ITERATIONS = 2;

    const getDeviceWasAbleToReadLabels = Boolean(constraints);
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        if (!getDeviceWasAbleToReadLabels && iteration < MAX_ITERATIONS) {
          // Check if there is a better camera to use once we have permissions
          getDevice().then((device) => {
            if (device && device.deviceId !== stream.getVideoTracks()[0].getSettings().deviceId) {
              userConfig.primaryConstraints.video.deviceId = device.deviceId;
              stopMediaTracks(stream);
              startCamera(userConfig.primaryConstraints, iteration++);
            } else {
              enableCamera(stream);
            }
          });
        } else {
          enableCamera(stream);
        }
      })
      .catch((error) => {
        callCameraError(error, AcuantJavascriptWebSdk.START_FAIL_CODE);
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
      errorCallback('Live capture has previously failed and was called again. User was sent to manual capture.', AcuantJavascriptWebSdk.REPEAT_FAIL_CODE);
      startManualCapture(manualCallback);
      return;
    }

    acuantCamera=document.getElementById('acuant-camera');

    if(!acuantCamera) {
      callCameraError('Expected div with \'acuant-camera\' id', AcuantJavascriptWebSdk.START_FAIL_CODE);
      return;
    }

    acuantCamera.style.position='relative';
    acuantCamera.innerHTML=
            '<video id="acuant-player" autoplay playsinline style="display:block; image-orientation:none; object-fit: fill;"></video>' +
            '<canvas id="acuant-ui-canvas" style="display:block; position:absolute; top:0; left:0;"></canvas>';

    player = document.getElementById('acuant-player');

    hiddenCanvas = document.createElement('canvas');
    //willReadFrequently is only enabled on Android since it's not implemented on iOS
    hiddenContext = hiddenCanvas.getContext('2d', { willReadFrequently: !isIOS() });

    uiCanvas = document.getElementById('acuant-ui-canvas');

    if (isStarted) {
      callCameraError('already started.', AcuantJavascriptWebSdk.START_FAIL_CODE);
    }
    else if (!player || !uiCanvas) {
      callCameraError('Missing HTML elements.', AcuantJavascriptWebSdk.START_FAIL_CODE);
    }
    else {
      uiContext = uiCanvas.getContext('2d');
      if (callback) {
        onDetectCallback = callback;
      }

      acuantCamera.dispatchEvent(new Event('acuantcameracreated'));
      startCamera(userConfig.primaryConstraints);
    }
  }

  function startManualCapture(callback) {
    onManualCaptureCallback = callback;
    if (!manualCaptureInput) {
      manualCaptureInput = document.createElement('input');
      manualCaptureInput.type = 'file';
      manualCaptureInput.capture = 'environment';
      manualCaptureInput.accept = 'image/*';
      manualCaptureInput.onclick = function(event) {
        if(event && event.target){
          event.target.value = '';
        }
      };
    }
    manualCaptureInput.onchange = onManualCapture;
    manualCaptureInput.click();
  }

  function getOrientation(e) {
    const view = new DataView(e.target.result);
    if (view.getUint16(0, false) != 0xFFD8) {
      return -2;
    }
    const length = view.byteLength;
    let offset = 2;
    while (offset < length) {
      if (view.getUint16(offset + 2, false) <= 8) return -1;
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker == 0xFFE1) {
        if (view.getUint32(offset += 2, false) != 0x45786966) {
          return -1;
        }

        const little = view.getUint16(offset += 6, false) == 0x4949;
        offset += view.getUint32(offset + 4, little);
        const tags = view.getUint16(offset, little);
        offset += 2;
        for (let i = 0; i < tags; i++) {
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

        if (isiOS15()) {
          MAX_WIDTH = MAX_VIDEO_WIDTH_IOS;
          MAX_HEIGHT = Math.floor(MAX_VIDEO_WIDTH_IOS * 3 / 4);
        }

        const largerDimension = width > height ? width : height;

        if (largerDimension > MAX_WIDTH) {
          if (width < height) {
            const aspectRatio = height / width;
            MAX_HEIGHT = MAX_WIDTH;
            MAX_WIDTH = MAX_HEIGHT / aspectRatio;
          }
          else {
            const aspectRatio = width / height;
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

        const imgData = hiddenContext.getImageData(0, 0, width, height);

        hiddenContext.clearRect(0, 0, MAX_WIDTH, MAX_HEIGHT);
        image.remove();

        onManualCaptureCallback.onCaptured({
          data:imgData,
          width: width,
          height: height
        });

        evaluateImage(imgData, width, height, null, 'MANUAL', onManualCaptureCallback.onCropped);
      };
    };
        
    if(file && file.files[0]){
      reader.readAsArrayBuffer(file.files[0]);
    }
  }

  function stopMediaTracks(stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  function isChromeForIOS() {
    const userAgent = window.navigator.userAgent;
    const isWebkit = userAgent.indexOf('WebKit') > -1;
    const isChrome = userAgent.indexOf('CriOS') > -1;
    return isWebkit && isChrome && isIOS();
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
        stopMediaTracks(player.srcObject);
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
      try {
        const v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
        return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
      } catch (_) {
        return -1;
      }
    }
    return -1;
  }

  function isiOS144Plus() {
    let ver = iOSversion();
    return ver && ver != -1 && ver.length >= 2 && ver[0] == 14 && ver[1] >= 4;
  }

  function isiOS15() {
    let ver = iOSversion();
    return ver && ver != -1 && ver.length >= 1 && ver[0] == 15;
  }

  function isiOS163OrLess() {
    let ver = iOSversion();
    return ver && ver != -1 && ver.length >= 1 && ver[0] == 16 && ver [1] < 4;
  }

  function isiOS164Plus() {
    let ver = iOSversion();
    return ver && ver != -1 && ver.length >= 1 && ver[0] >= 16 && ver [1] >= 4;
  }

  function isDeviceAffectedByIOS16Issue() {
    let decodedCookie = decodeURIComponent(document.cookie);
    if (decodedCookie.includes('AcuantForceRegularCapture=true')) {
      return false;
    }
    if (decodedCookie.includes('AcuantForceDistantCapture=true')) {
      return true;
    }
    if (isiOS163OrLess()) {
      let dims = [screen.width, screen.height];
      let long = Math.max(...dims);
      let short = Math.min(...dims);
      if (long == 852 && short == 393) { //14 pro
        return true;
      }
      if (long == 932 && short == 430) { //14 pro max
        return true;
      }
      if (long == 844 && short == 390) { //13 pro
        return true;
      }
      if (long == 926 && short == 428) { //13 pro max
        return true;
      }
    }
    return false;
  }

  function isiPad13Plus() {
    return navigator.maxTouchPoints && navigator.maxTouchPoints >= 2 && /MacIntel/.test(navigator.platform);
  }

  function onResize() {
    uiContext.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    if (player) {
      if (isIOS() && (isChromeForIOS() || isiOS144Plus())) {
        endCamera();
        start(); 
      } else {
        setDimens();
      }
    }
  }

  function setDimens() {
    let targetWidth;
    let targetHeight;

    if (player.videoWidth < player.videoHeight) {
      userConfig.canvasScale = (player.videoHeight / player.videoWidth);
    }
    else {
      userConfig.canvasScale = (player.videoWidth / player.videoHeight);
    }
    targetWidth = window.innerWidth;
    targetHeight = window.innerHeight;
    if (!userConfig.fixedHeight) userConfig.fixedHeight = acuantCamera.clientHeight;
    if (!userConfig.fixedWidth) userConfig.fixedWidth = acuantCamera.clientWidth;
    if (userConfig.fixedHeight && userConfig.fixedWidth && userConfig.fixedWidth > userConfig.fixedHeight) {
      userConfig.fixedHeight = acuantCamera.clientWidth;
      userConfig.fixedWidth = acuantCamera.clientHeight;
    }

    if (window.matchMedia('(orientation: portrait)').matches) {
      if (userConfig.fixedWidth) {
        if (userConfig.fixedWidth < targetWidth) {
          targetWidth = userConfig.fixedWidth;
        }
        targetHeight = targetWidth * userConfig.canvasScale;
      } else if (userConfig.fixedHeight) {
        let width = userConfig.fixedHeight / userConfig.canvasScale;
        if (width < targetWidth) {
          targetHeight = userConfig.fixedHeight;
          targetWidth = width;
        }
      }
    } else {
      if (userConfig.fixedWidth) {
        if (userConfig.fixedWidth < targetHeight) {
          targetHeight = userConfig.fixedWidth;
        }
        targetWidth = targetHeight * userConfig.canvasScale;
      } else if (userConfig.fixedHeight) {
        let width = userConfig.fixedHeight / userConfig.canvasScale;
        if (width < targetHeight) {
          targetWidth = userConfig.fixedHeight;
          targetHeight = width;
        }
      }
    }
    player.width = uiCanvas.width = targetWidth;
    player.height = uiCanvas.height = targetHeight;
  }

  //We need to restart the camera when navigator is sent to background at devices where the zoom constraint is applied,
  //otherwise, zoom value is override when resuming capture
  function onVisibilityChange() {
    if (manualCaptureInput || !isStarted) {
      return;
    }

    if (document.visibilityState === 'visible') {
      endCamera();
      start();
    }
  }

  function runDetection() {
    if (!player || player.paused) {
      return;
    }

    processFrameForDetection();
    detectTimeout = setTimeout(runDetection, 100); // detecting at most 10 times a second, short circuits out very quickly if detect is running
  }

  function onLoadedMetaData() {
    if (player.videoWidth + player.videoHeight < 1000) {
      endCamera();
      callCameraError('Camera not supported', AcuantJavascriptWebSdk.START_FAIL_CODE);
    } else {
      setDimens();
      runDetection();
    }
  }

  // We need this to re-create the detect timeout after browser is backgrounded/resumed since the timer is throttled by the OS
  function restartDetectionAfterBrowserResume() {
    if (!detectTimeout) {
      return;
    }

    clearTimeout(detectTimeout);
    isDetecting = false;
    runDetection();
  }

  function evaluateImage(imgData, width, height, isPortraitOrientation, capType, callback) {
    let result = { isPortraitOrientation };
    let waitingOnTheOther = true;

    AcuantJavascriptWebSdk.moire(imgData, width, height, {
      onSuccess: function (moire, moireraw) {
        result.moire = moire;
        result.moireraw = moireraw;

        if (waitingOnTheOther) {
          waitingOnTheOther = false;
        } else {
          finishCrop(result, capType, callback);
        }
      },
      onFail: function () {
        result.moire = -1;
        result.moireraw = -1;

        if (waitingOnTheOther) {
          waitingOnTheOther = false;
        } else {
          finishCrop(result, capType, callback);
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
          finishCrop(result, capType, callback);
        }
      },
      onFail: function () {
        callback();
      }
    });
  }

  function finishCrop(result, capType, callback) {

    async function handleMetrics (sharpness, glare) {
      result.sharpness = sharpness;
      result.glare = glare;
      result.image.data = await toBase64(result, capType);
      if (document.getElementById(AcuantJavascriptWebSdk.BARCODE_READER_ID)) {
        try{
          result.image.barcodeText = await scanImage(result.image.data);
        } catch (e) { result.image.barcodeText = undefined; }
      }
      signImage(result, callback);
    }

    AcuantJavascriptWebSdk.metrics(result.image, result.image.width, result.image.height, {
      onSuccess: handleMetrics,
      onFail: () => handleMetrics(-1, -1),
    });
  }

  function scanImage(image) {
    let arr = image.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while(n--){
      u8arr[n] = bstr.charCodeAt(n);
    }
    const imageFile = new File([u8arr], 'imageFile', {type:mime});
    let html5qrcode = new Html5Qrcode(AcuantJavascriptWebSdk.BARCODE_READER_ID, { formatsToSupport: [ Html5QrcodeSupportedFormats.PDF_417 ] });
    return html5qrcode.scanFile(imageFile, false);
  }

  function signImage(result, callback) {
    const imageData = base64ToArrayBuffer(result.image.data);
    AcuantJavascriptWebSdk.sign(imageData, {
      onSuccess: function (signedImageData) {
        result.image.data = 'data:image/jpeg;base64,' + arrayBufferToBase64(signedImageData);
        callback(result);
      },
      onFail: function () {
        callback();
      }
    });
  }

  function removeEvents() {
    if (isSamsungNote10OrS10OrNewer()) {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    window.removeEventListener('resize', onResize);
    if (player) {
      player.removeEventListener('play', restartDetectionAfterBrowserResume);
      player.removeEventListener('loadedmetadata', onLoadedMetaData);
    }
  }
    
  function addEvents() {
    if (isSamsungNote10OrS10OrNewer()) {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    window.addEventListener('resize', onResize);
    if (player) {    
      player.addEventListener('play', restartDetectionAfterBrowserResume);
      player.addEventListener('loadedmetadata', onLoadedMetaData);
    }
  }

  function processFrameForDetection() {
    if (!isStarted || isDetecting) {
      return;
    }
    if (player.videoWidth == 0) {
      sequenceBreak();
      return;
    }
    isDetecting = true;

    let max = Math.max(player.videoWidth, player.videoHeight);
    let min = Math.min(player.videoWidth, player.videoHeight);
    let newCanvasHeight = 0;
    let newCanvasWidth = 0;

    if (max > TARGET_LONGSIDE_SCALE && min > TARGET_SHORTSIDE_SCALE) {
      if (player.videoWidth >= player.videoHeight) {
        userConfig.frameScale = (TARGET_LONGSIDE_SCALE / player.videoWidth);
        newCanvasWidth = TARGET_LONGSIDE_SCALE;
        newCanvasHeight = player.videoHeight * userConfig.frameScale;
      }
      else {
        userConfig.frameScale = (TARGET_LONGSIDE_SCALE / player.videoHeight);
        newCanvasWidth = player.videoWidth * userConfig.frameScale;
        newCanvasHeight = TARGET_LONGSIDE_SCALE;
      }
    }
    else {
      userConfig.frameScale = 1;
      newCanvasWidth = player.videoWidth;
      newCanvasHeight = player.videoHeight;
    }

    if (newCanvasWidth != hiddenCanvas.width || newCanvasHeight != hiddenCanvas.height) {
      hiddenCanvas.width = newCanvasWidth;
      hiddenCanvas.height = newCanvasHeight;
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

      detect(imgData, hiddenCanvas.width, hiddenCanvas.height);
    }
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

        const minRatio = Math.min(response.dimensions.width, response.dimensions.height) / Math.min(hiddenCanvas.width, hiddenCanvas.height);
        const maxRatio = Math.max(response.dimensions.width, response.dimensions.height) / Math.max(hiddenCanvas.width, hiddenCanvas.height);
        const isPassport = response.type == 2;
        let minRatioUpperBoundThreshold = 0.8;
        let maxRatioUpperBoundThreshold = 0.85;
        let minRatioLowerBoundThreshold = 0.6;
        let maxRatioLowerBoundThreshold = 0.65;
        if (isPassport) {
          minRatioUpperBoundThreshold = 0.9;
          maxRatioUpperBoundThreshold = 0.95;
        }

        if (isIOS()) {
          minRatioLowerBoundThreshold = 0.65;
          maxRatioLowerBoundThreshold = 0.7;
          if (isDeviceAffectedByIOS16Issue()) {
            if (isPassport) { //intentionally large to help address issues with cvml inaccuaretly detecting passports
              minRatioUpperBoundThreshold = 0.72;
              maxRatioUpperBoundThreshold = 0.77;
              minRatioLowerBoundThreshold = 0.22;
              maxRatioLowerBoundThreshold = 0.28;
              // minRatioLowerBoundThreshold = 0.57;
              // maxRatioLowerBoundThreshold = 0.53;
            } else { //id
              minRatioUpperBoundThreshold = 0.41;
              maxRatioUpperBoundThreshold = 0.45;
              minRatioLowerBoundThreshold = 0.22;
              maxRatioLowerBoundThreshold = 0.28;
            }
          } else if (isPassport) {
            minRatioUpperBoundThreshold = 0.95;
            maxRatioUpperBoundThreshold = 1;
            minRatioLowerBoundThreshold = 0.7;
            maxRatioLowerBoundThreshold = 0.75;
          }
        }

        const isTooFarAway = !response.isCorrectAspectRatio || (minRatio < minRatioLowerBoundThreshold && maxRatio < maxRatioLowerBoundThreshold);
        const isTooClose = minRatio >= minRatioUpperBoundThreshold || maxRatio >= maxRatioUpperBoundThreshold;

        if (response.type === ACUANT_DOCUMENT_TYPE.NONE) {
          response.state = DOCUMENT_STATE.NO_DOCUMENT;
        } else if (isTooClose) {
          response.state = DOCUMENT_STATE.BIG_DOCUMENT;
        } else if (isTooFarAway) {
          response.state = DOCUMENT_STATE.SMALL_DOCUMENT;
        }  else {
          response.state = DOCUMENT_STATE.GOOD_DOCUMENT;
        }
        onDetectCallback(response);
        isDetecting = false;
      },
      onFail: function () {
        if (!hiddenCanvas || !player || player.paused || player.ended)
          return;

        let response = {};
        response.state = DOCUMENT_STATE.NO_DOCUMENT;
        onDetectCallback(response);
        isDetecting = false;
      }
    });
  }

  function triggerCapture(callback) {
    let imgData, isPortraitOrientation;
    try {
      if (player.videoWidth == 0) {
        throw 'width 0';
      }
      hiddenCanvas.width = player.videoWidth;
      hiddenCanvas.height = player.videoHeight;
    
      hiddenContext.drawImage(player, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
      imgData = hiddenContext.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
      hiddenContext.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
      isPortraitOrientation = window.matchMedia('(orientation: portrait)').matches;
    } catch (e) {
      sequenceBreak();
      return;
    }
        
    callback({
      data: imgData,
      width: hiddenCanvas.width,
      height: hiddenCanvas.height,
      isPortraitOrientation,
    });
  }

  async function toBase64(result, capType) {

    if (!hiddenCanvas || !hiddenContext) {
      hiddenCanvas = document.createElement('canvas');
      hiddenContext = hiddenCanvas.getContext('2d');
    }

    hiddenCanvas.width = result.image.width;
    hiddenCanvas.height = result.image.height;

    let mImgData = hiddenContext.createImageData(result.image.width, result.image.height);

    setImageData(mImgData.data, result.image.data);
    hiddenContext.putImageData(mImgData, 0, 0);

    let isManual = capType != 'AUTO' && capType != 'TAP';

    if (result.cardtype !== 2) {
      if ((!isManual && result.isPortraitOrientation) || (isManual && captureOrientation === 6)) {
        hiddenContext.rotate(Math.PI); //180 degrees
        //the width and height are negative as an alternative to counting out the transform needed 
        // to get to the middle of the image. Avoids possible mistakes with off by one pixel.
        hiddenContext.drawImage(hiddenCanvas, 0, 0, -hiddenCanvas.width, -hiddenCanvas.height); 
      }
    }

    result.image.bytes = hiddenContext.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height).data;

    let quality = (typeof acuantConfig !== 'undefined' && typeof acuantConfig.jpegQuality === 'number') ? acuantConfig.jpegQuality : 1.0;
    let base64Img = hiddenCanvas.toDataURL('image/jpeg', quality);
    hiddenContext.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);

    if (hiddenCanvas) {
      hiddenContext = null;
      hiddenCanvas.remove();
      hiddenCanvas = null;
    }

    const exifResult = await addExif(result, capType, base64Img);
    return exifResult;
  }

  function getCvmlVersion() {
    return new Promise((resolve) => {
      AcuantJavascriptWebSdk.getCvmlVersion({
        onSuccess: (version) => {
          resolve(version);
        },
        onFail: () => {
          resolve('unknown');
        }
      });
    });
  } 

  async function addExif(result, capType, base64Img) {
    const cvmlVersion = await getCvmlVersion();
    const imageDescription = JSON.stringify({
      'cvml':{ 
        'cropping':{
          'iscropped': true,
          'dpi': result.dpi,
          'idsize': result.cardType === 2 ? 'ID3': 'ID1',
          'elapsed': -1
        },
        'sharpness':{
          'normalized': result.sharpness,
          'elapsed': -1
        },
        'moire':{
          'normalized': result.moire,
          'raw': result.moireraw,
          'elapsed': -1
        },
        'glare':{
          'normalized': result.glare,
          'elapsed': -1
        },
        'version': cvmlVersion
      },
      'device':{
        'version': getBrowserVersion(),
        'capturetype': capType
      }
    });
    return AcuantJavascriptWebSdk.addMetadata(base64Img, { imageDescription, dateTimeOriginal: new Date().toUTCString() });
  }

  function getBrowserVersion() {
    const ua = navigator.userAgent;
    let tem, M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];

    if (/trident/i.test(M[1])) {
      tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
      return 'IE '+(tem[1] || '');
    }
    if (M[1] === 'Chrome') {
      tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
      if(tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
    }
    M = M[2] ? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
    if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
    return M.join(' ');
  }

  function setImageData(imgData, src) {
    for (let i = 0; i < imgData.length; ++i) {
      imgData[i] = src[i];
    }
  }

  function cameraHasFailedBefore() {
    let name = 'AcuantCameraHasFailed=';
    let decodedCookie = decodeURIComponent(document.cookie);
    return decodedCookie.includes(name);
  }

  function sequenceBreak() {
    if (isiOS15() || isiPad13Plus()) {
      callCameraError(SEQUENCE_BREAK_IOS_15, AcuantJavascriptWebSdk.SEQUENCE_BREAK_CODE);
    } else {
      callCameraError(SEQUENCE_BREAK_OTHER, AcuantJavascriptWebSdk.SEQUENCE_BREAK_CODE);
    }
  }

  function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64.split('base64,')[1]);
    const len = binary_string.length;
    const bytes = new Uint8Array(new ArrayBuffer(len));
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  return svc;
})();
