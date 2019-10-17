# Acuant Javascript Web SDK v11.0.0


**October 2019**

----------

# Introduction #

Acuant JavaScript Web SDK utilizes Emscripten to build native C++ libraries into binary Web Assembly and Javascript. Images are processed by Wasm Libraries asychronously using HTML5 Web Workers and accesibile by Javascript. 

----------
## Modules ##

The SDK includes the following modules:

**Acuant Javascript SDK (AcuantJavascriptSDK.js) :**

- Allows clients to access functionality
- Abstraction layer for AcuantImageProcessingService.js

**Acuant Image Service (AcuantImageProcessingService.js, AcuantImageProcessingService.wasm) :**

- Interface file to interact with AcuantImageProcessingWorker
- Can be used directly without AcuantJavascriptSDK.js

**Acuant Image Processsing Worker (AcuantImageProcessingWorker.js, AcuantImageProcessingWorker.wasm) :**

- HTML5 Web Worker
- Asynchronously uses WebAssembly to process images

----------
### Setup ###

1. Add the following dependent on these files. These files should be accessible by HTTP in public resource directory of the hosted application:


 -	AcuantJavascriptSDK.js
 -	AcuantImageProcessingService.js
 -	AcuantImageProcessingService.wasm
 -	AcuantImageProcessingWorker.js
 -	AcuantImageProcessingWorker.wasm


1. Load Acuant Javascript SDK:


    	<script async src="AcuantJavascriptSDK.js" />
    	
    	
1. Define a callback. This is an optional global javascript function that will be exectued when wasm has loaded. Define the callback before the script tag above:
		
		var onAcuantSdkLoaded = function(){
	       //sdk has been loaded;
	    }


----------
### Process Image ###



1. Start Worker. Only one worker is allowed per application. If start has been previously called, nothing will happen:
		
		AcuantJavascriptWebSdk.start();
		
1. Initialize. If worker has not been started, this call will start the worker:

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
        


1. Crop Image:
		
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
						dpi: number,
						sharpness: number,
						glare: number,
						isPassport: boolean,
						image:{
							data: string,
							width: number,
							height: number
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
1. End Worker. Only end if resources are needed. It is expensive to start and end workers so it is recommended to minimally start and end workers:
		
		AcuantJavascriptWebSdk.end();



-------------------------------------------------------------

**Copyright 2019 Acuant Inc. All rights reserved.**

This document contains proprietary and confidential information and creative works owned by Acuant and its respective licensors, if any. Any use, copying, publication, distribution, display, modification, or transmission of such technology, in whole or in part, in any form or by any means, without the prior express written permission of Acuant is strictly prohibited. Except where expressly provided by Acuant in writing, possession of this information shall not be construed to confer any license or rights under any Acuant intellectual property rights, whether by estoppel, implication, or otherwise.

AssureID and *i-D*entify are trademarks of Acuant Inc. Other Acuant product or service names or logos referenced this document are either trademarks or registered trademarks of Acuant.

All 3M trademarks are trademarks of Gemalto Inc.

Windows is a registered trademark of Microsoft Corporation.

Certain product, service, or company designations for companies other
than Acuant may be mentioned in this document for identification
purposes only. Such designations are often claimed as trademarks or
service marks. In all instances where Acuant is aware of a claim, the
designation appears in initial capital or all capital letters. However,
you should contact the appropriate companies for more complete
information regarding such designations and their registration status.

[https://support.acuant.com](https://support.acuant.com)

**Acuant Inc. 6080 Center Drive, Suite 850, Los Angeles, CA 90045**

----------------------------------------------------------