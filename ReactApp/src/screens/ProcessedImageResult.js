import React, {Component, Fragment} from 'react';
import Header from "./Header";
import {bindActionCreators} from "redux";
import {connect} from "react-redux";
import {decrementSidesLeft, incrementSidesLeft, setCardOrientation} from "./actions/idPropertiesActions";
import ApiService from "../services/api/api";
import Processing from "./Processing";

class ProcessedImageResult extends Component {

    constructor(props) {
        super(props);
        this.state = {
            processing: false        
        }
    }

    proceedToNextStep() {
        this.sendImageToAPI(this.dataURLToBlob(this.props.cardImage));
    }

    processClassification(classificationData) {
        this.setProcessing(false);

        if (classificationData && classificationData.PresentationChanged) {
            this.props.setCardOrientation(0);
        } else {
            this.props.setCardOrientation(1);
        }
        if (classificationData && classificationData.Type.Size !== 3 || this.props.cardType === 2) {
            this.props.decrementSidesLeft();

            if (this.props.sidesLeft === 1) {
                this.props.history.push('/capture/photo');
            } else {
                if (process.env.REACT_APP_FRM_ENABLED === 'true' && this.props.cardType === 1) {
                    this.props.history.push('/capture/selfie')
                } else {
                    if (this.props.cardType === 1) {
                        this.props.history.push('/results/default');
                    }

                    if (this.props.cardType === 2) {
                        this.props.history.push('/results/medicard');
                    }
                }
            }
        } else {
            if (process.env.REACT_APP_FRM_ENABLED === 'true' && this.props.cardType === 1) {
                this.props.history.push('/capture/selfie')
            } else {
                this.props.history.push('/results/default');
            }
        }
    }

    setProcessing(value){
        this.setState({
            processing:value
        })
    }

    sendImageToAPI(blobData) {
        this.setProcessing(true);

        if ((this.props.frontSubmitted && this.props.sidesLeft === 2) || (this.props.backSubmitted && this.props.sidesLeft === 2) || (this.props.backSubmitted && this.props.frontSubmitted && this.props.sidesLeft === 1)) {
            ApiService.replaceImage(this.props.instanceID, this.props.orientation, blobData)
                .then(response => {
                    if (this.props.cardType === 1) {
                        this.getClassification();
                    } else {
                        this.processClassification(null);
                    }
                })
                .catch(err => {
                    this.setProcessing(false);
                    this.props.history.push({pathname: '/error/default', state: {retryLastStep: true}});
                    throw new Error(err);
                })
        } else {
            ApiService.postImage(this.props.instanceID, this.props.orientation, blobData)
                .then(response => {
                    if (this.props.cardType === 1) {
                        this.getClassification();
                    } else {
                        this.processClassification(null);
                    }
                })
                .catch(err => {
                    this.setProcessing(false);
                    this.props.history.push({pathname: '/error/default', state: {retryLastStep: true}});
                    throw new Error(err);
                })
        }
    }

    getClassification() {
        ApiService.getClassification(this.props.instanceID)
            .then(result => {
                if (result.Type && result.Type.ClassName === 'Unknown') {
                    this.setProcessing(false);
                    this.props.history.push('/error/default');
                } else {
                    if (result.PresentationChanged && this.props.sidesLeft === 2) {
                        this.props.setCardOrientation(1);
                        this.processClassification(result);
                    } else {
                        this.processClassification(result);
                    }
                }

            })
            .catch(err => {
                this.setProcessing(false);
                this.props.history.push('/error/default');
                throw new Error(err);
            });
    }

    dataURLToBlob(canvasDataURL) {
        let binary = atob(canvasDataURL.split(',')[1]);
        let array = [];
        for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
        }
        return new Blob([new Uint8Array(array)], { type: 'image/jpg' });
    }

    retryPhoto() {
        this.props.history.push('/capture/photo', {isRetry: true})
    }

    renderTitleText() {
        if (this.props.blurry) return "Image appears blurry. Please retry.";
        if (this.props.hasGlare) return "Image has glare. Please retry.";
        return "Ensure all texts are visible."
    }


    render() {
        if (this.state.processing) {
            return <Processing />
        }
        return (
            <Fragment>

                <Header />

                <div className='body column capture_photo'>

                    {this.props.blurry &&

                        <div className='column description_container'>
                            <img alt='idscango' className='icon' src={require('../assets/images/icon_attention@2x.png')} />
                            <p className={'description error'}>{this.renderTitleText()}</p>
                        </div>
                    }

                    <div className='row wrapper description_container'>
                        {!this.props.blurry && <p className={'description'}>{this.renderTitleText()}</p>}
                    </div>

                    <div className="capture_group">

                        <div className='row wrapper capture_container'>
                            {this.props.cardImage && <img alt={'idscango'} src={this.props.cardImage} className='capture'/>}
                        </div>

                        <div className="wrapper column capture_controls">

                            <a className={'btn'} onClick={() => this.proceedToNextStep()}>
                                <p className={'buttonBgText'}>Continue with this image</p>
                            </a>
                            {<div className={'btn outline'} onClick={() => this.retryPhoto()}>
                                <p className={'buttonBdText'}>Retry</p>
                            </div>}

                        </div>

                    </div>

                </div>

            </Fragment>
        )
    }
}

function mapStateToProps(state) {
    return {
        instanceID: state.config.instanceID,
        orientation: state.idProperties.orientation,
        cardType: state.idProperties.cardType,
        sidesLeft: state.idProperties.sidesLeft,
        frontSubmitted: state.config.frontSubmitted,
        backSubmitted: state.config.backSubmitted,
        cardImage: state.captureProperties.image.data,
        blurry: state.captureProperties.sharpness < 50,
        hasGlare: state.captureProperties.glare < 50
    };
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({decrementSidesLeft, incrementSidesLeft, setCardOrientation}, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(ProcessedImageResult);