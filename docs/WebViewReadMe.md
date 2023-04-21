# Web View Implementation Information

## Android

1. The app that contains the WebView must first declare and obtain the following permissions:
	
    	<uses-permission android:name="android.permission.INTERNET"/>
    	<uses-permission android:name="android.permission.CAMERA" />
    
1. Override the following methods within 'webChromeClient' property of your WebView, using either an inline object or a custom class.

		
	* This function is used to grant the relevant permissions to the webpage:
	
		
			override fun onPermissionRequest(request: PermissionRequest) {
				request.grant(request.resources)
			}
        
	* The following function implements the file selection dialog for the manual capture fallback (if the user does not grant or unexpectedly revokes the camera permission):
	
			override fun onShowFileChooser(
			    webView: WebView?,
			    filePathCallback: ValueCallback<Array<Uri>>?,
			    fileChooserParams: FileChooserParams?
			): Boolean {
				//save the callback to be accessible to the on activity result function.
				this@MainActivity.filePathCallback = filePathCallback
				    
				//create the file selection dialog intent from the params set by the webpage.
				val intent = fileChooserParams!!.createIntent()
				try {
					//launch activity for result.
					resultLauncher.launch(intent)
				} catch (e: ActivityNotFoundException) {
					//this exception is highly unlikely, but should be handled nonetheless. Since the file selection dialog is already the fallback to the main capture experience, assume the user is unable to proceed via the app.
					return false
				}
				return true
			}
			
	* Then add the following at the activity level:

			//the callback being saved to be accessible in the activity.
			private var filePathCallback: ValueCallback<Array<Uri>>? = null
			
			//the modern format of start activity for result.
			private val resultLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
				val data: Intent? = result.data
				
				//pass the data to the WebView.
				filePathCallback?.onReceiveValue(
					WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
				)
			}
			
1. For the WebView settings, set the following properties:

		wvSettings.javaScriptEnabled = true
		wvSettings.domStorageEnabled = true
		wvSettings.allowFileAccess = true
		wvSettings.allowContentAccess = true
		wvSettings.javaScriptCanOpenWindowsAutomatically = true
		wvSettings.mediaPlaybackRequiresUserGesture = false

## iOS

1. Declare a camera permission message by adding NSCameraUsageDescription to the info.plist.
		
1. iOS requires the following WebView definition:

		//Create Web View
		let webConfiguration = WKWebViewConfiguration()
		webConfiguration.allowsInlineMediaPlayback = true
		WKWebView(frame: CGRect(x: 0, y: 0, width: 200, height: 200), configuration: webConfiguration)
		
		//Load Web View
		let request = URLRequest(url: "yourWebUrl")
		webView.load(request)