# Migration Details JavaScript Web SDK

**v11.5.0**

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
      
Most likely, you are already using a viewport meta tag for your Mobile page. Using a meta tag is now a requirement. If you don’t use the tag, the device will render at a much higher resolution and cause frequent GPU and memory failures.

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


----------

**v11.4.2**

## ACAS endpoint now required for initialization.

- Replace the old `id_endpoint` with the new `acas_endpoint` in the initialize method. For more information, see [here](https://github.com/Acuant/JavascriptWebSDKV11/blob/master/#initialize-and-start-web-worker).


----------

**v11.4.0**

## Updated Supported Browsers for Live Capture
- Live capture will not be supported on Firefox at this time.
- If the device is running earlier than iOS 13.0, then Live Capture will not be supported.


## Updated AcuantCameraUI
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


    

## Updated Live Capture WebRTC constraints
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
