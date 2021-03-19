# Acuant JavaScript Web SDK v11.4.4


**March 2021**

See [https://github.com/Acuant/JavascriptWebSDKV11/releases](https://github.com/Acuant/JavascriptWebSDKV11/releases) for release notes.

----------

## License
This software is subject to Acuant's end user license agreement (EULA), which can be found [here](EULA.pdf).

----------

## Introduction
 
This document provides detailed information about the Acuant JavaScript Web SDK. The JavaScript Web SDK allows developers to integrate image capture and processing functionality in their mobile web applications.

----------

## Migration information

See [Migration Details](docs/MigrationDetail11.4.2.md) for more information.

----------

## Modules

The SDK includes the following modules:

**Acuant JavaScript SDK (AcuantJavaScriptSdk.min.js):**

- Live Document Capture functionality 
- Uses Acuant library to detect documents, crop, calculate sharpness and glare.
- Additional Camera UI provided by Acuant.
- Face Capture with Passive Liveness using credentials

**Acuant Image Service (AcuantImageProcessingService.js.mem):**

- Interface file to interact with **AcuantImageProcessingWorker**

**Acuant Image Processsing Worker (AcuantImageProcessingWorker.js, AcuantImageProcessingWorker.wasm):**

- HTML5 Web Worker to process the images

----------
## Setup

1. Add the following dependencies on these files (**Note**:  These files should be accessible by HTTP in the public resource directory of the hosted application.):
	- **AcuantJavaScriptSdk.min.js**
	- **AcuantImageProcessingService.js.mem**
	- **AcuantImageProcessingWorker.min.js**
	- **AcuantImageProcessingWorker.wasm**

1. Load AcuantJavascriptSdk script:
	
		<script async src="AcuantJavascriptWebSdk.min.js"></script>

1. Define a custom path to load files (if different than root):

		const acuantConfig = {
			path: "/custom/path/to/sdk/"
		}
    	
    	
1. Define a callback *before* the script tag in step 2. This is an optional global JavaScript function that is executed after Wasm is loaded.
		
		var onAcuantSdkLoaded = function(){
	       //sdk has been loaded;
	    }
	     
----------
## Initialize and Start Web Worker

1. Start the HTML5 Web Worker. (**Note**: Only one worker is allowed per application therefore, if you previously called start, it won't start another instance.)
		
		AcuantJavascriptWebSdk.start();
		
1. Set the token credentials and ACAS endpoint required to initialize the Worker.

		function initialize(
			token : string, //Acuant credentials in base64 (basic auth format id:pass)
			endpoint : string, //endpoint for Acuant's ACAS server
			callback: object); //callback shown below
	
		var callback = {
			onSuccess:function(){
			},
			onFail:function(code, description){
			}
		}
	Use the following ACAS endpoints based on region:
	
		USA: https://us.acas.acuant.net
		EU: https://eu.acas.acuant.net
		AUS: https://aus.acas.acuant.net
		
	Use the following ACAS endpoint for testing purposes:
	
		PREVIEW: https://preview.acas.acuant.net
		
1. Initialize the Worker. (**Note**: If worker has not been started, this call will start the Worker.)

		AcuantJavascriptWebSdk.initialize(
            token, 
            endpoint,
            callback);

1. End the Worker. (**Note**: You should *only* end the Worker if the library is no longer needed. It is expensive to start and end web workers.)
		
		AcuantJavascriptWebSdk.end();
            
----------
## Live Capture using WebRTC

Live capture offers guidance to the user to position documents and initiates autocapture when detected. This feature is present only when WebRTC is available in the browser. 

**Supported browsers**

The JavaScript Web SDK supports the following web browsers for live capture of ID documents:

- **Android**: Chrome
- **iOS**: Safari, with iOS version >= 13.0 

For other browsers that do not support WebRTC, the device's camera app (manual capture) is used.

**Camera Preview**

- **Android**: Android uses browser supported fullScreen mode for camera preview. User can exit out of this fullscreen mode. We recommend hiding all elements on page while camera is shown.
- **iOS**: iOS will fill up screen height with camera preview. We recommend hiding all elements on page while camera is shown.

**Tap to Capture**

- Tap to capture will be enabled for devices that can support the resolution constraints, but cannot support the image processing.
- When the camera is launched, the image processing speed is automatically checked. If the speed is above the threshold set at 400ms, live document detection and autocapture features are disabled and switched to tap to capture. The user will have to manually capture the document.


----------
## AcuantCameraUI

**Prerequisite**: Initialize Acuant Worker (see [Initialize and Start Web Worker](#initialize-and-start-web-worker))

- This is used for live capture; live detection, frame analysis, and auto capture of documents. After capture, it also processes the image.
- AcuantCameraUI is the default implementation of the UI and uses AcuantCamera to access device's native camera via WebRTC.

### Start Live Capture

1. Add HTML to show the live capture preview:
		
		<video id="acuant-player" controls autoplay style="display:none;" playsinline></video>
		<canvas id="acuant-video-canvas" width="100%" height="auto"></canvas>

1. Set custom strings. (Optional)

		var options = {
			text:{
				NONE: "ALIGN",
				SMALL_DOCUMENT: "MOVE CLOSER",
				GOOD_DOCUMENT: null,//default countdown
				CAPTURING: "CAPTURING",
				TAP_TO_CAPTURE: "TAP TO CAPTURE"
			}
		};
	
1. Set up callback to retrieve the image at each state of the camera. For more information on the processed image returned via **onCropped**, see [Image from AcuantCameraUI and AcuantCamera](#image-from-acuantcameraui-and-acuantcamera).
	
		var cameraCallback = {
			onCaptured: function(response){
				//document captured
				//this is not the final result of processed image
				//show a loading screen until onCropped is called
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
				//this is optional
				//get each frame if needed
				//console.log(response)
				response = {
					type: Number,
					dimensions: Object,
					dpi: Number,
					isCorrectAspectRatio: Boolean,
					points: Array,
					state: Number => {
				   		NO_DOCUMENT: 0,
						SMALL_DOCUMENT: 1,
						GOOD_DOCUMENT: 2
					}
				}
			}
		}

1. Start live capture camera.

		AcuantCameraUI.start(cameraCallback, (error) => {
			//constraint error or camera not supported
			//show manual capture
		}, options)
		    
1. End Camera.

		AcuantCameraUI.end();
	
	**Note**: Once AcuantCameraUI onCaptured is called, the end API is internally executed.
	
If you are not using AcuantCameraUI and you wish to use your own live capture UI, you can call AcuantCamera directly to utilize document detection, frame analysis, and auto capture (see [Use Your Own Custom Live Capture UI](#use-your-own-custom-live-capture-ui)).
	
----------

## AcuantCamera

**Prerequisite:**
	Initialize Acuant Worker (see [Initialize and Start Web Worker](#initialize-and-start-web-worker)).

### Start Manual Capture

- This camera is used for manual capture. It opens the device's native camera app, which is useful when WebRTC is not available. Unlike AcuantCameraUI, it does not provide frame analysis or document detection. It does process the image after capture.
	
1. Start manual capture. For more information on the processed image returned via **onCropped**, see [Image from AcuantCameraUI and AcuantCamera](#image-from-acuantcameraui-and-acuantcamera). 
		
        AcuantCamera.startManualCapture({
            onCaptured: function(response){
                //this will be called after user finishes capture
                //then proceeds to crop
                //onCropped will be called after finished
            },
            onCropped: function(response){
                if(response){
                    //cropped response;
                    
                }
                else{
                    //Error occurred during cropping; retry capture
                }
            }
        });
        
	**Important**: AcuantCamera manual capture uses `<input type="file"/>` html tags to access the device's camera app. This REQUIRES a user initiated event to start the camera.

	**Note**: Acuant recommends not hiding any UI elements when starting manual capture. Be aware users will be able to cancel out of the device's camera app screen.
	
### Use Your Own Custom Live Capture UI

When not using the default AcuantCameraUI for the live capture preview. You can implement your own live capture preview and use AcuantCamera to do the frame analysis, document detection, and auto capture.
		
1. Add HTML:
		
		<video id="acuant-player" controls autoplay style="display:none;" playsinline></video>
		<canvas id="acuant-video-canvas" width="100%" height="auto"></canvas>
		
1. Start the Camera Preview:

		const player = document.getElementById('acuant-player');
		
		const videoCanvas = document.getElementById('acuant-video-canvas');
		const videoContext = videoCanvas.getContext('2d');
			
		player.addEventListener('play', function () {
			var $this = this; //cache
			(function loop() {
			  if (!$this.paused && !$this.ended) {
			    videoContext.drawImage($this, 0, 0, videoCanvas.width, videoCanvas.height);
			    
			    //draw any custom UI here
			    //draw on the videoCanvas and videoContext
			    
			    setTimeout(loop, 1000 / 60); // drawing at 60fps
			  }
			})();
		}, 0);	

1. Start the frame analysis. Pass in a callback that will be called while camera is active.

		 AcuantCamera.start((response) => {
	      	response = {
	      		//type of document
	      		type: AcuantCamera.ACUANT_DOCUMENT_TYPE,
	      		
	      		//state of camera
	      		state: AcuantCamera.DOCUMENT_STATE,
	      		
	      		//points of document corners
	      		points: [{x: Number, y: Number}, {x: Number, y: Number}, {x: Number, y: Number}, {x: Number, y: Number}],
	      		
	      		//dimensions of document
	      		dimesions:{ width: Number, Height: Number },
	      		
	      		//document dpi
	      		dpi: Number,
	      		
	      		//if document has correct aspect ratio
	      		isCorrectAspectRatio: boolean
	      }
	    }, error => {
	    	//error occured. Most likely WebRTC not supported. Use manual capture
	    });
	    
1. Capture when document is ready.

		AcuantCamera.triggerCapture((response) => {
			if (response) {
				response = {
					image: { 
						data: String,
						width: Number,
						height: Number
					}, 
					glare: Number, 
					sharpness: Number,
					cardType: Number,//define card type, None = 0, ID = 1, Passport = 2
					dpi: Number
            	}
	      	}
	      	else {
	      		//error
	      	}
    	});    

**AcuantCamera Info**

		const AcuantCamera = (function(){
		    let isCameraSupported = boolean;

		    const DOCUMENT_STATE = {
		        NO_DOCUMENT: 0,
		        SMALL_DOCUMENT: 1,
		        GOOD_DOCUMENT: 2
		    };
	
		    const ACUANT_DOCUMENT_TYPE = {
		        NONE: 0,
		        ID: 1,
		        PASSPORT: 2
		    };
		    
		    // open manual capture
		    function startManualCapture(cb, errorCb)
		    
		    // used for live capture UI (AcuantCameraUI or custom)
		    function start(cb, errorCb)//start the frame analysis
		    function triggerCapture(cb)//capture
		    function end()//end camera
		    
		})();
		
----------
## Process the Image

**Prerequisite:**
	Initialize Acuant Worker (see [Initialize and Start Web Worker](#initialize-and-start-web-worker)).
	
### Image from AcuantCameraUI and AcuantCamera ###
	
When using AcuantCameraUI and AcuantCamera, after the document image is captured, it is automatically processed with crop, sharpness, and glare. 

**Cropping, Sharpness, and Glare**

The processed image and data are returned via the camera **onCropped** callback. The image can be used to verify the crop, sharpness, and glare of the image, and then upload the document. 

Here is the response from the callback:

            response = {
					image: { 
						data: String,
						width: Number,
						height: Number
					}, 
					glare: Number, 
					sharpness: Number,
					cardType: Number,//define card type, None = 0, ID = 1, Passport = 2
					dpi: Number
            	}
	      	}

If the sharpness value is greater than 50, then the image is considered sharp (not blurry). If the glare value is 100, then the image does not contain glare. If the glare value is 0, then image contains glare. When image is obtained and has passed metrics, it is ready for upload.

**Note**: If using Acuant web service to authenticate documents, the image must be sharp and not contain glare to get best results in authentication and data extraction. When the image has glare, low sharpness, or both, retake the image. Acuant recommends against modifying and/or compressing the resulting image before uploading to the Acuant web service. Modifying and/or compressing the image may negatively affect authentication and data extraction results.

### Process the Image Manually ###
	
This information is for processing images manually if not captured through AcuantCameraUI and AcuantCamera.
	
1. Info on the crop function:
		
		function crop(
			data : object, //image data from context object shown below
			width : number, //width of image
			height: number,  //height of image
			callback: object, //callback shown below);

2. Create a canvas for the image to be processed:

		let canvas = document.createElement('canvas'),
			context = canvas.getContext('2d'),
			context.drawImage(YOUR_IMAGE, 0, 0, MAX_WIDTH = 2560, MAX_HEIGHT = 1920),
			imgData = context.getImageData(),
      
3. Add the callback:

		var callback = {
			onSuccess:function(result){
				result = {
					dpi: Number,
					sharpness: Number,
					glare: Number,
					cardType: Number,//card type, 0 = None, 1 = ID, 2 = Passport
					image:{
						data: String,
						width: Number,
						height: Number
					}
				}
			},
			onFail:function(){
			}
		}

4. Call the crop function:

		AcuantJavascriptWebSdk.crop(
			imgData,
			width, 
			height,  
        	callback);


-------------------------------------------------------------
## Face Capture and Acuant Passive Liveness
**Prerequisite:**
	To use the face capture and FaceID API, credentials with FaceID must be enabled. 

Acuant recommends using the **LiveAssessment** property rather than the score) to evaluate response. **AcuantPassiveLiveness.startSelfieCapture** will return a rescaled image.

Follow these recommendations to effectively process an image for passive liveness:
#### Image requirements
- **Height**:  minimum 480 pixels; recommended 720 or 1080 pixels
- **Compression**:  Image compression is not recommended (JPEG 70 level or above is acceptable). For best results, use uncompressed images.

#### Face requirements
- Out-of-plane rotation:  Face pitch and yaw angle: from -20 to 20 degrees +/-3 degrees
- In-plane rotation:  Face roll angle: from -30 to 30 degrees +/- 3 degrees
- Pupillary distance:  Minimum distance between the eyes 90 +/- 5 pixels
- Face size: Minimum 200 pixels in either dimension
- Faces per image: 1
- Sunglasses: Must be removed

#### Capture requirements
The following may significantly increase errors or false results:

- Using a motion blur effect
- Texture filtering
- A spotlight on the face and nearest surroundings
- An environment with poor lighting or colored light

**Note**: Face live capture and guidance is not supported, only manual capture is available. Also, the use of fish-eye lenses is not supported by this API.

### Start face capture and send Passive Liveness request

**Important:** Do not use this function for face capture if you are not using the Acuant FaceID API.

1. Start face capture with device's camera app.

		AcuantPassiveLiveness.startSelfieCapture(callback:function(base64img){
			//called with result
		})
		
1. Upload face image and send request for Passive Liveness result.

		AcuantPassiveLiveness.postLiveness({
			endpoint: "ACUANT_PASSIVE_LIVENESS_ENDPOINT",
			token: "ACUANT_PASSIVE_LIVENESS_TOKEN",
			subscriptionId: "ACUANT_PASSIVE_LIVENESS_SUBSCRIPTIONID",
			image: base64img
		}, function(result){
			result = {
				LivenessResult = {
					LivenessAssessment : String = 
						//POSSIBLE VALUES
						"Live", 
						"NotLive",
						"PoorQuality", 
						"Error";
					Score: 0
				},
				Error: "",//error description
				ErrorCode: String = 
					//POSSIBLE VALUES
					"Unknown", 
					"FaceTooClose", 
					"FaceNotFound", 
					"FaceTooSmall", 
					"FaceAngleTooLarge", 
					"FailedToReadImage", 
					"InvalidRequest", 
					"InvalidRequestSettings",
					"Unauthorized", 
					"NotFound"
			}
		})
		
### Known Issues:

1. When using Passive Liveness camera on Google Chrome for Android, the camera defaults to the back facing instead of the front facing camera. Users can tap to switch to the front facing camera.

	This is a Chrome issue and unfortunately, we cannot provide a workaround at this time.

	See: 
	[https://bugs.chromium.org/p/chromium/issues/detail?id=1182828]()
	[https://stackoverflow.com/questions/56721653/why-doesnt-capture-user-change-my-phones-camera-to-front-facing]()
	
1. When embedding the AcuantCamera live capture preview onto an iframe, it may squish the preview causing capture and document detection issues. The workaround is to add iframe properties in the CSS.

	Add the following iframe properties in the CSS on the page that will use the iframe:

		iframe {
			border: 0 !important;
			height: 100%;
			width: 100% !important;
		}
		.iframe-content{
			height: auto;
		}
		
		@media only screen and (max-width: 600px) {
			iframe {
				height: 100%;
			}
			.iframe-content{
				height: 96%;
			}
		}
		
	Add the HTML canvas on the page embedded in the iframe:

		<div style="display:none" id="camera">
			<video id="acuant-player" controls="" autoplay="" style="display:none;" playsinline=""></video>
			<div style="text-align: center !important;width: 100% !important;">
				<canvas id="acuant-video-canvas" width="100%" height="auto"></canvas>
			</div>
		</div>
		
----------
**Copyright 2021 Acuant Inc. All rights reserved.**

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
