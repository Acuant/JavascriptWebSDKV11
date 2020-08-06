# Acuant idScanGo - Web #

## License
This software is subject to Acuant's end user license agreement (EULA), which can be found [here](EULA.pdf).

## Introduction

### Setup ###

This project works with **Node JS 6.10** and above. Please ensure that you have it installed otherwise please follow up [this link](https://nodejs.org/en/).

### How to Run the Project ###
* **Step 1** - Download or clone this repository
* **Step 2** - Open up the terminal or command prompt and proceed to the project's directory
* **Step 3** - run ```npm install```. This command will install all the required dependencies.
* **Step 4** -
For setting up the app you have to explicitly set Environment variables in .env file that you can find in this folder.

These are the available environment variables that you'll find in the file. 

```
PUBLIC_URL=
REACT_APP_BASENAME=
REACT_APP_ID_ENDPOINT=https://services.assureid.net
REACT_APP_FRM_ENDPOINT=https://frm.acuant.net
REACT_APP_MEDICSCAN_ENDPOINT=https://medicscan.acuant.net
REACT_APP_LIVENESS_ENDPOINT=https://us.passlive.acuant.net
REACT_APP_USER_NAME=
REACT_APP_PASSWORD=
REACT_APP_SUBSCRIPTION_ID=
REACT_APP_FRM_ENABLED=true
REACT_APP_GLARE_METRIC_ENABLED=false
REACT_APP_SHARPNESS_METRIC_ENABLED=true
REACT_APP_IDPASSPORT_ENABLED=true
REACT_APP_MEDICAL_CARD_ENABLED=true
REACT_APP_MOBILE_ONLY=true
REACT_APP_SENTRY_SUBSCRIPTION_ID=

```

```PUBLIC_URL``` is the URL of your app. For e.g. https://idscangoweb.acuant.com
```REACT_APP_FRM_ENABLED``` - set this to true if you want to enable Facial Recognition Match
```REACT_APP_IDPASSPORT_ENABLED``` - Set this to true if you would like to enable ID and Passport option
```REACT_APP_MEDICAL_CARD_ENABLED``` - Set this to true if you would like to enable Medical Insurance Card option
```REACT_APP_MOBILE_ONLY``` - Set this option to true if you want the app to run only on mobile devices
```REACT_APP_SENTRY_SUBSCRIPTION_ID``` is optional.

* **Step 5** - To run the app, call ```npm run start```. The project will start running on ```http://localhost:3000``` (default address). You do not need to set ```PUBLIC_URL``` and ```BASENAME``` if you are running the app on default address using  ```npm run start```.


### \*IMPORTANT\* ###

If you're deploying the App to a sub-folder on the server (For e.g. IIS on a Windows Server), you need to explicitly set BASENAME environment variable otherwise the app won't work. This applications uses virtual routes that are set by React Router. React Router assumes that the App will be available at the root of the domain. If you’re delivering the app from a subfolder in IIS (you created a folder under Default WebSite in IIS for the app) you should set the basename to that subfolder name (For e.g. if the sub-folder name in IIS is idscangoweb, so basename value would be "/idscangoweb"). Otherwise, if it’s delivered from the root domain, basename should be “/“.

### Building for deployment ###

In general, React apps are static HTML apps and are built by running ```npm run build```. This will create the ```build``` directory inside the project's folder.
You can upload the contents of the ```build``` folder to a server or an S3 bucket.
Remember to change the ```PUBLIC_URL``` and ```REACT_APP_BASENAME``` env variables accordingly in the .env file.


### Worklflow Diagram ###
![](https://github.com/Acuant/HTML/blob/master/HTML_Workflow.png)
