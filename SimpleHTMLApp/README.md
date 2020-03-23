# Acuant JavaScript Web SDK v11.3.1


**March 2020**

----------

# Introduction
 
This document provides detailed information about the Acuant JavaScript Web SDK. The JavaScript Web SDK allows developers to integrate image capture and processing functionality in their mobile web applications.

----------
## Supported browsers

The JavaScript Web SDK supports the following web browsers for live capture of ID documents:

- **Android**: Chrome, Firefox11.
- **iOS**: Safari

For other browsers, regular HTML capture is used.


## Modules

The SDK includes the following modules:

**Acuant JavaScript SDK (AcuantJavaScriptSdk.min.js):**

- Live Document Capture functionality 
- Face Capture with Passive Liveness available with credentials
- Additional Camera UI provided by Acuant.
- Uses Acuant library to detect documents, crop, calculate sharpness and glare.

**Acuant Image Service (AcuantImageProcessingService.wasm):**

- Interface file to interact with **AcuantImageProcessingWorker**

**Acuant Image Processsing Worker (AcuantImageProcessingWorker.js, AcuantImageProcessingWorker.wasm):**

- HTML5 Web Worker to process the images

----------
### Setup

1. Add the following dependencies on these files (**Note**:  These files should be accessible by HTTP in the public resource directory of the hosted application.):
	- **AcuantJavaScriptSdk.min.js**
	- **AcuantImageProcessingService.wasm**
	- **AcuantImageProcessingWorker.min.js**
	- **AcuantImageProcessingWorker.wasm**

1. Load AcuantJavascriptSdk script:
	
		<script async src="AcuantJavascriptSdk.min.js" />

1. Definte a custom path to load files (if different than root):

		const acuantConfig = = {
			path: "/custom/path/to/sdk/"
		}
    	
    	
1. Define a callback *before* the script tag in step 2. This is an optional global JavaScript function that is executed after Wasm is loaded.
		
		var onAcuantSdkLoaded = function(){
	       //sdk has been loaded;
	    }
	     
----------
## AcuantPassiveLiveness

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

**Note**  The use of fish-eye lenses is not supported by this API.

### Start face capture and send  Passive Liveness request

1. Start face capture.

		AcuantPassiveLiveness.startSelfieCapture(callback:function(base64img){
			//called with result
		})
		
1. Send Passive Liveness Request.

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
		


----------
### Initialize and Start Web Worker

1. Start the HTML5 Web Worker. (**Note**: Only one worker is allowed per application therefore, if you previously called start, it won't start another instance.)
		
		AcuantJavascriptWebSdk.start();
		
1. Initialize the Worker. (**Note**: If worker has not been started, this call will start the Worker.)

		function initialize(
			token : string, //token provieded by Acuant
			endpoint : string, //Acuant endpoint 
			callback: object); //callback shown below
	
		var callback = {
			onSuccess:function(){
			},
			onFail:function(){
			}
		}

		AcuantJavascriptWebSdk.initialize(
            token, 
            endpoint,
            callback);

1. End the Worker. (**Note**: You should *only* end the Worker if the library is no longer needed. It is expensive to start and end web workers.)
		
		AcuantJavascriptWebSdk.end();
            
----------
### AcuantCameraUI

- Uses AcuantCamera to access native camera.
- Default implementation of UI. Use AcuantCamera directly for any custom UI.

**Prerequisite**: Initialize Acuant Worker (see Step 2 above).

1. Add HTML
		
		<video id="acuant-player" controls autoplay style="display:none;" playsinline></video>
		<canvas id="acuant-video-canvas" width="100%" height="auto"></canvas>
	
1. Start the Camera and get result.
	
		 AcuantCameraUI.start((response) => {
		 	//use response if needed
	      	//end
	    }, (error) => {
	      alert("Camera not supported\n" + error);
	    });
	    
1. End Camera.

		AcuantCameraUI.end();
----------

### AcuantCamera

**Prerequisite:**
	Initialize Acuant Worker (see Step 2 above).
		
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
					isPassport: Boolean,
					dpi: Number
            	}
	      	}
	      	else {
	      		//error
	      	}
    	});    
    	
1. Manual Capture:
		
		AcuantCamera.startManualCapture({
	      onCaptured: function(){
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


1. AcuantCamera Info:

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
		    
		    function start(cb, errorCb)//start the frame analysis
		    
		    function startManualCapture(cb, errorCb)
		    
		    function triggerCapture(cb)//capture
		    
		    function end()//end camera
		    
		})();
		
----------
### Process the Image

**Prerequisite:**
	Initialize Acuant Worker (see Step 2 above).
	
1. Process the image:
		
		function crop(
			data : object, //image data from context object shown below
			width : number, //width of image
			height: number,  //height of image
			callback: object, //callback shown below
			includeSharpness: boolean = true, //include sharpness calculation. default=true
			includeGlare: boolean = true); //include glare calculation. default = true
			
		let canvas = document.createElement('canvas'),
			context = canvas.getContext('2d'),
			context.drawImage(YOUR_IMAGE, 0, 0, MAX_WIDTH = 2560, MAX_HEIGHT = 1920),
        	imgData = context.getImageData(),
			
			callback = {
				onSuccess:function(result){
					result = {
						dpi: Number,
						sharpness: Number,
						glare: Number,
						isPassport: Boolean,
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

		AcuantJavascriptWebSdk.crop(
			imgData,
			width, 
			height,  
        	callback, 
        	false, 
        	true);



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
