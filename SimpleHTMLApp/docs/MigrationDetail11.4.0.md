# Migration Details JavaScript Web SDK v11.4.0


**July 2020**

----------
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
