import ApiService from "../../services/api/api";
import {history} from './../../store';
import MedicScanService from "../../services/api/medicScan";

function getOverallAuth(type) {

    switch (type) {
        case 0 :
            return 'Unknown';
        case 1:
            return 'Passed';
            break;
        case 2:
            return 'Failed';
            break;
        case 3:
            return 'Skipped';
        case 4:
            return 'Caution';
        case 5:
            return 'Attention';
        default:
            return 'Unknown';
    }
}

export function processID(instanceID, detailed = true) {
    return (dispatch) => {
        ApiService
            .getResults(instanceID)
            .then(async res => {
                var documentObj = res;
                var base64FaceReformattedImage = null;
                var base64SignatureReformattedImage = null;
                let dataObject = {};
                if (documentObj.Fields.length > 0) {

                    /**
                     * Pass processed data to our data object
                     */

                    documentObj.Fields.map(field => {
                        dataObject[field.Name] = field.Value;
                    });

                    let type = res.Result;
                    let idAuthentication = null;

                    if(!detailed) {
                        idAuthentication = getOverallAuth(type);
                    } else {
                        idAuthentication = "Overall : " + getOverallAuth(type) + "\n";
                        var i;
                        for (i = 0; i < res.Alerts.length; ++i) {
                            let alert = res.Alerts[i];
                            if (alert.Result != 1) {

                                idAuthentication += alert.Description + " : " + alert.Disposition + "\n";
                            }
                        }
                    }

                    dataObject['Authentication'] = idAuthentication;

                    /**
                     * Get face image from Acuant Service
                     * Get signature image from Acuant Service
                     * Initialize Photo & Signature with empty strings otherwise it will try to access the photo on the
                     * Acuant servers
                     *
                     * We need async / await if in case something happens with the Photo / Signature. We'll want to
                     * show the results no matter the results
                     */
                    dataObject['Photo'] = '';
                    dataObject['Signature'] = '';

                    let chunk = 5000;
                    try {
                        const faceImageResult = await ApiService.getFaceImage(instanceID);
                        let faceImageResultArray = new Uint8Array(faceImageResult);
                        let rawFaceImage = '';
                        let faceImageResultSubArray, chunk = 5000;
                        for (let i = 0, j = faceImageResultArray.length; i < j; i += chunk) {
                            faceImageResultSubArray = faceImageResultArray.subarray(i, i + chunk);
                            rawFaceImage += String.fromCharCode.apply(null, faceImageResultSubArray);
                        }
                        base64FaceReformattedImage = btoa(rawFaceImage);
                        dataObject['Photo'] = `data:image/jpeg;base64,${base64FaceReformattedImage}`;
                    } catch (err) {

                    }
                    try {
                        const signatureImageResult = await ApiService.getSignatureImage(instanceID);
                        let signatureImageResultArray = new Uint8Array(signatureImageResult);
                        let rawSignatureImage = '';
                        let signatureImageResultSubArray;
                        for (let i = 0, j = signatureImageResultArray.length; i < j; i += chunk) {
                            signatureImageResultSubArray = signatureImageResultArray.subarray(i, i + chunk);
                            rawSignatureImage += String.fromCharCode.apply(null, signatureImageResultSubArray);
                        }

                        base64SignatureReformattedImage = btoa(rawSignatureImage);

                        dataObject['Signature'] = `data:image/jpeg;base64,${base64SignatureReformattedImage}`;
                    } catch (err) {

                    }

                    dispatch({payload: dataObject, type: '@@acuant/ADD_ID_RESULT_DATA'});

                } else {
                    history.push('/error/default');
                }
            })
            .catch(err => {
                history.push('/error/default')
            });
    }
}

export function processMedicard(data) {
    return (dispatch) => {
        MedicScanService.getMedicScanResults({
            instanceID: data.instanceID,
            subscriptionID: data.subscriptionID
        }).then(async res => {
            console.log(res);
            let documentObj = res;
            if (documentObj.FrontImage) {
                documentObj.FrontImage = `data:image/jpeg;base64,${documentObj.FrontImage}`;
            }
            if (documentObj.BackImage) {
                documentObj.BackImage = `data:image/jpeg;base64,${documentObj.BackImage}`;
            }
            dispatch({payload: documentObj, type: '@@acuant/ADD_ID_RESULT_DATA'});
        }).catch(err => {
            history.push('/error/default')
        })
    }
}

export function resetProcessedData() {
    return {
        type: "@@acuant/RESET_PROCESSED_DATA"
    }
}