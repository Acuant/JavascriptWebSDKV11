# Migration Details JavaScript Web SDK

## v11.7.1

v11.7.1 is backwards compatible. This section provides details about the focus issues in iOS 16 and tools for more in-depth implementations. If you are not interested in this information, you can ignore this section.

iOS 16 introduced issues that affect the iPhone 13 Pro, 13 Pro Max, 14 Pro, and 14 Pro Max. In the JS camera, iOS  exposes only a generic front and back camera. Apple's implementation of this generic back camera always selects the same (non-near focus) camera on multi-camera devices and does not re-select when that camera fails to focus. As a result, we have no way to select a camera that can focus at short distances. Apple also did not implement zoom control for cameras in JS, nor a way to know the camera's minimum focus distance. We have contacted Apple about this issue. However, in the meantime, we have provided a workaround.

Forcing these devices to capture from farther away achieves adequate sharpness. Due to iOS 16's increased stability, we also were able to increase the capture resolution for the affected devices. As a result, even though these devices are capturing from farther away, the higher resolution results in a DPI similar to that of other devices. The main limitation to this workaround is the detection of the affected devices. Because modern browsers do not provide detailed information about the user's device inside of the UA, we have to use secondary characteristics to "fingerprint" these devices. The simplest method that results in a high success rate is to examine the device's viewport. If the viewport matches one of four hardcoded sizes, we instruct the device to run at a higher resolution and to capture from farther away.

This method, however, can occasionally result in false positives and false negatives. There are several devices (the iPhone 12, 12 Pro, 12 Pro Max, 13, and 14) that share a viewport size with the affected devices. As a result, those devices also will be instructed to capture from farther away. This behavior is not a major concern because those devices can still capture a sharp image with adequate DPI at this increased distance. Additionally, if one of the affected devices is running with an nonstandard viewport size, the device will not be detected and likely will be unable to focus. We consider this to be a rare edge case, but it is possible.

To help account for these cases, we provided the ability for the implementer to override this detection by setting one of the following cookies on the page:

`AcuantForceRegularCapture=true` forces the capture to proceed at a normal distance, while

`AcuantForceDistantCapture=true` forces the capture to use the far away capture.

If both cookies are set, `AcuantForceRegularCapture=true` takes priority. If, as an implementer, you have additional knowledge about the user's device, you can use the cookies to guarantee that the user is instructed to capture at the correct distance. You also can use the cookies to, for example, send a user to distant capture if the user has captured a blurry image several times. Or, prompt the user by asking whether the user's device is one of the affected ones, and then use the cookies to send the user to the correct capture flow.

On most devices manual capture also allows for capture of sharp, high resolution images, this is another alternative if a user is consistently getting low sharpness.

We are hopeful that Apple will resolve this issue so we can return all devices to the regular capture.


## v11.7.0

### AcuantCamera

A new document state (BIG_DOCUMENT) was added to determine whether the document is placed too close to the camera. The possible states are as follows:

```
  const DOCUMENT_STATE = {
    NO_DOCUMENT: 0,
    SMALL_DOCUMENT: 1,
    BIG_DOCUMENT: 2,
    GOOD_DOCUMENT: 3
  };
```

When starting the camera, the text options should be as follows:

```
const options = {
    text: {
      NONE: "ALIGN",
      SMALL_DOCUMENT: "MOVE CLOSER",
      BIG_DOCUMENT: "TOO CLOSE",
      GOOD_DOCUMENT: null,//null countdown
      CAPTURING: "CAPTURING",
      TAP_TO_CAPTURE: "TAP TO CAPTURE"
    }
  }
```

## v11.6.0

### AcuantCameraUI

Add ```maximum-scale=1,user-scalable=no``` to the viewport meta tag. This parameter ensures that the screen resizes correctly upon device rotation.
Your viewport meta tag should look like this: 

```
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
```

### Passive Liveness

Because real-time face detection is supported on Android, you have to update your implementation as follows:

1. In addition to ```AcuantPassiveLiveness.min.js```, include the following SDK files::

	- **opencv.min.js**
	- **face_landmark_68_tiny_model-weights_manifest.json**
	- **face_landmark_68_tiny_model.bin**
	- **tiny_face_detector_model-shard1**
	- **tiny_face_detector_model-weights_manifest.json**

1. Add ```opencv.min.js``` to your imports.

	```
	<script src="AcuantJavascriptWebSdk.min.js"></script>
	<script async src="AcuantPassiveLiveness.min.js"></script>
	<script async src="opencv.min.js" charset="utf-8"></script>
	```

1. Add an HTML element to show a face capture preview.

	```
	<div id="acuant-face-capture-container"></div>
	```

1. Optionally, create custom detection texts.

	```
	const faceDetectionStates = {
		FACE_NOT_FOUND: "FACE NOT FOUND",
	 	TOO_MANY_FACES: "TOO MANY FACES",
	 	FACE_ANGLE_TOO_LARGE: "FACE ANGLE TOO LARGE",
	 	PROBABILITY_TOO_SMALL: "PROBABILITY TOO SMALL",
	 	FACE_TOO_SMALL: "FACE TOO SMALL",
	 	FACE_CLOSE_TO_BORDER: "TOO CLOSE TO THE FRAME"
	}
	```

	**Note:** The module does not provide the text UI element.

1. Setup callback:

	```
	var faceCaptureCallback = {
		onDetection: (text) => {
			//Triggered when the face does not pass the scan. The UI element
			//should be updated here to provide guidence to the user
		},
		onOpened: () => {
			//Camera has opened
		},
		onClosed: () => {
			//Camera has closed
		},
		onError: (error) => {
			//Error occurred. Camera permission not granted will 
			//manifest here with 1 as error code. Unexpected errors will have 2 as error code.
		},
		onPhotoTaken: () => {
			//The photo has been taken and it's showing a preview with a button to accept or retake the image
		},
		onPhotoRetake: () => {
			//Triggered when retake button is tapped
		},
		onCaptured: (base64Image) => {
			//Triggered when accept button is tapped
		}
	}
	```

	**Note:** On iOS only onCaptured will be called

1. Update how the camera is started:

	Replace:
	```
	AcuantPassiveLiveness.startSelfieCapture((image) => { })
	```
	With:
	```
	AcuantPassiveLiveness.start(faceCaptureCallback, faceDetectionStates);
	```

	**Note:** Upon iOS calling, ```AcuantPassiveLiveness.start``` launches the native camera. Alternatively, the module exposes ```startManualCapture``` method that launches the native camera and returns the image taken in base64.

1. Update how you get Passive Liveness result:

	Replace:
	```
	AcuantPassiveLiveness.postLiveness({
		endpoint: "ACUANT_PASSIVE_LIVENESS_ENDPOINT",
		token: "ACUANT_PASSIVE_LIVENESS_TOKEN",
		subscriptionId: "ACUANT_PASSIVE_LIVENESS_SUBSCRIPTIONID",
		image: base64img
	}, (result) => { })
	```
	With:
	```
	AcuantPassiveLiveness.getLiveness({
		endpoint: "ACUANT_PASSIVE_LIVENESS_ENDPOINT",
		token: "ACUANT_PASSIVE_LIVENESS_TOKEN",
		subscriptionId: "ACUANT_PASSIVE_LIVENESS_SUBSCRIPTIONID",
		image: base64img
	}, (result) => { })
	```

----------

## v11.5.0

Delete all old sdk files then copy in the new ones:

- **AcuantJavaScriptSdk.min.js**
- **AcuantCamera.min.js**
- **AcuantPassiveLiveness.min.js**
- **AcuantInitializerWorker.min.js**
- **AcuantInitializerServicejs**
- **AcuantInitializerService.wasm**
- **AcuantImageWorker.min.js**
- **AcuantImageService.js**
- **AcuantImageService.wasm**
- **AcuantMetricsWorker.min.js**
- **AcuantMetricsService.js**
- **AcuantMetricsService.js.mem**

Replace your imports with the following:

	<script src="AcuantJavascriptWebSdk.min.js"></script>
	<script async src="AcuantCamera.min.js"></script>
	<script async src="AcuantPassiveLiveness.min.js"></script>
		
Remove the old html elements (canvas and video) and replace them with a single div with the following ID:

	<div id="acuant-camera"></div>
      
Most likely, you are already using a viewport meta tag for your Mobile page. Using a meta tag is now a requirement. If you don't use the tag, the device will render at a much higher resolution and cause frequent GPU and memory failures.

	<meta name="viewport" content="width=device-width, initial-scale=1">
		
In your *onSuccess* from the initialize function, add the following:

	AcuantJavascriptWebSdk.startWorkers(() => {
		//continue init here
	});
		
The AcuantCameraUI error callback has an additional parameter. For a current list of codes, see the AcuantCameraUI section of the Readme. 

	Replace this:
		AcuantCameraUI.start(cameraCallback, (error) => {});
	With:
		AcuantCameraUI.start(cameraCallback, (error, code) => {});
		
After Live Capture fails, subsequent calls to Live Capture will start Manual Capture. This is intended as a fallback and not behavior to rely on. You should still configure your implementation to call Manual Capture after an error.

The error state is stored through a temporary cookie between page reloads. This behavior is intended to help mitigate an iOS 15 issue and to create a smoother workflow when a camera permission has been permanently declined.
		
On old iOS devices, consider not running metrics as the devices can struggle to run them. See the readme or the sample app for how to start only the image worker. Improving metrics performance on old iOS devices will be investigated in the future.
		
If you are using custom camera implementations, review the **Use Your Own Custom Live Capture UI** section of the Readme because the process has changed.

If you are using an implementation that loads the SDK at a later point (for example, after the page is fully loaded), once the scripts are fully loaded, call the following function:

	loadAcuantSdk();


----------

## v11.4.2

### ACAS endpoint now required for initialization.

- Replace the old `id_endpoint` with the new `acas_endpoint` in the initialize method. For more information, see [here](https://github.com/Acuant/JavascriptWebSDKV11/blob/master/#initialize-and-start-web-worker).


----------

## v11.4.0

### Updated Supported Browsers for Live Capture

- Live capture will not be supported on Firefox at this time.
- If the device is running earlier than iOS 13.0, then Live Capture will not be supported.


### Updated AcuantCameraUI

**This release of the AcuantCamera API includes significant improvements. You may need to modify your implementation.**

1.) AcuantCameraUI no longer starts manual capture. We recommend adding a check for AcuantCamera.isCameraSupported before starting AcuantCameraUI.start(). Example shown below

	if(AcuantCamera.isCameraSupported){
		//start AcuantCameraUI
	}
	else{
		//start AcuantCamera Manual capture
	}
		
		
2.) The AcuantCameraUI callbacks has been modified to divide image capture and image processing. After the document is captured, the onCaptured callback will be notified. The image will be processed and cropped asynchronously, and will call the onCropped once finished. We internally end the AcuantCamera and AcuantCameraUI after capture. Added new onFrameAvailable callback if frames are needed for additional data.

		
	var cameraCallback = {
		onCaptured: function(response){
			//document captured
			//this is not the final result of processed image
			//display a loading screen until onCropped is called
		},
		onCropped: function(response){
			if (response) {
				//use response
			}
			else{
				//cropping error
				//restart capture
			}
		},
		onFrameAvailable: function(response){
			//get each frame if needed
			//console.log(response)
			response = {
				type: Number,//define card type, None = 0, ID = 1, Passport = 2
				dimensions: Object,
				dpi: Number,
				isCorrectAspectRatio: Boolean,
				points: Array,
				state: Number //define document state, NO_DOCUMENT = 0, SMALL_DOCUMENT = 1, GOOD_DOCUMENT = 2
			}
		}
	}

	AcuantCameraUI.start(cameraCallback, (error) => {
		//follow constraint error step below
	}, options)


    

### Updated Live Capture WebRTC constraints
- AcuantCamera uses new constraints to start live capture in mediaDevices. If these constraints are not satisfied, you will have to handle the error callback. Acuant recommends starting manual capture if this error occurs. 
- **IMPORTANT**: AcuantCamera manual capture uses \<input type="file"/> html tags to access the native camera. This REQUIRES a user initiated event to start the camera.
		
		//old constraints
		video: {
			facingMode: { exact: "environment" },
			height: { ideal: 1440 },
		}
		
		
		//new constraints
		video: {
			facingMode: { exact: "environment" },
			height: { min: 1440, ideal: 1440 },
			aspectRatio: 1.777777778
		}


-------------------------------------------------------------

**Copyright 2020 Acuant Inc. All rights reserved.**

This document contains proprietary and confidential information and creative works owned by Acuant and its respective licensors, if any. Any use, copying, publication, distribution, display, modification, or transmission of such technology, in whole or in part, in any form or by any means, without the prior express written permission of Acuant is strictly prohibited. Except where expressly provided by Acuant in writing, possession of this information shall not be construed to confer any license or rights under any Acuant intellectual property rights, whether by estoppel, implication, or otherwise.

AssureID and *i-D*entify are trademarks of Acuant Inc. Other Acuant product or service names or logos referenced this document are either trademarks or registered trademarks of Acuant.

All 3M trademarks are trademarks of Gemalto/Thales Inc.

Windows is a registered trademark of Microsoft Corporation.

Certain product, service, or company designations for companies other
than Acuant may be mentioned in this document for identification
purposes only. Such designations are often claimed as trademarks or
service marks. In all instances where Acuant is aware of a claim, the
designation appears in initial capital or all capital letters. However,
you should contact the appropriate companies for more complete
information regarding such designations and their registration status.

For technical support, go to: [https://support.acuant.com](https://support.acuant.com)

**Acuant Inc. 6080 Center Drive, Suite 850, Los Angeles, CA 90045**

----------------------------------------------------------
