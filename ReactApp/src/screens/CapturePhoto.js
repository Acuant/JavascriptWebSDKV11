import React, { Component, Fragment } from 'react';
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import Header from "./Header";
import { decrementSidesLeft, setCardOrientation, setCardType } from "./actions/idPropertiesActions";
import { setInstanceID, submitBackID, submitFrontID } from "./actions/configActions";
import ApiService from "../services/api/api";
import Processing from "./Processing";

class CapturePhoto extends Component {

    constructor(props) {
        super(props);
        this.state = {
            inputValue: null,
            processing: false        
        }
        this.textInput = React.createRef();
    }

    isIEorEDGE() {
        return navigator.appName === 'Microsoft Internet Explorer' || (navigator.appName === "Netscape" && navigator.appVersion.indexOf('Edge') > -1);
    }

    processImage(event) {
        let file = event.target,
            reader = new FileReader();

        this.setState({
            processing: true
        });

        if (!file) {
            this.setState({
                processing: false
            });
            return;
        }
        window.scrollTo(0, 0)

        if (this.isIEorEDGE()) {
            this.sendImageToAPI(file.files[0]);
            return;
        }

        reader.onload = function(e){
            if (window.File && window.FileReader && window.FileList && window.Blob) {
                let image = document.createElement('img');
                image.src = e.target.result;
                image.onload = () => {
                    let canvas = document.createElement('canvas'),
                        context = canvas.getContext('2d'),
                       MAX_WIDTH = 2560,
                       MAX_HEIGHT = 1920,
                        width = image.width,
                        height = image.height;

                      //context.drawImage(image, 0, 0);

                   var largerDimension = width > height ? width : height;

                    if (largerDimension > MAX_WIDTH) {
                        if (width < height) {
                            var aspectRatio = height / width;
                            MAX_HEIGHT = MAX_WIDTH;
                            MAX_WIDTH = MAX_HEIGHT / aspectRatio;
                        }
                        else {
                            var aspectRatio = width / height;
                            MAX_HEIGHT = MAX_WIDTH / aspectRatio;
                        }
                    } else {
                        MAX_WIDTH = image.width;
                        MAX_HEIGHT = image.height;
                    } 

                   canvas.width = MAX_WIDTH;
                   canvas.height = MAX_HEIGHT;

                    // canvas.width = width;
                    // canvas.height = height;

                    context = canvas.getContext('2d');
                    
                    context.mozImageSmoothingEnabled = false;
                    context.webkitImageSmoothingEnabled = false;
                    context.msImageSmoothingEnabled = false;
                    context.imageSmoothingEnabled = false;

                    context.drawImage(image, 0, 0, MAX_WIDTH, MAX_HEIGHT);         

                     width = MAX_WIDTH;
                     height = MAX_HEIGHT;

                    var imgData = context.getImageData(0, 0, width, height);

                    window.AcuantJavascriptWebSdk.crop(imgData, width, height,  
                    {
                        onSuccess: function(result){
                            if(result.dpi < 300){
                                this.props.history.push({pathname: '/error/lowresolution', state: {retryLastStep: true}});
                            }
                            else{
                                var isBlurry=false,
                                    hasGlare = false
                                if (result.sharpness < 50 && process.env.REACT_APP_SHARPNESS_METRIC_ENABLED === 'true') {
                                    isBlurry = true;
                                }
                                if (result.glare < 50 && process.env.REACT_APP_GLARE_METRIC_ENABLED === 'true') {
                                    hasGlare = true;
                                }

                                this.props.history.push('/photo/confirm', {
                                    blurry: isBlurry,
                                    hasGlare: hasGlare,
                                    cardImage: result.image.data
                                });
                            }
                        }.bind(this),

                        onFail: function(){
                            this.props.history.push('/error/default');
                        }.bind(this)
                    });
                }
            }
        }.bind(this);

        reader.readAsDataURL(file.files[0]);
    }


    componentDidMount() {
        if (!this.props.instanceID) {
            this.props.setInstanceID();
        }
        if (this.props.location && this.props.location.state) {
            if (this.props.location.state.isRetry) {
                this.textInput.current.click();
            }
        }
    }

    getOrientationCopy() {
        return this.props.orientation === 0 ? 'front' : 'back';
    }

    getCardTypeCopy() {
        switch (this.props.cardType) {
            case 1:
                return 'ID card';
            case 2:
                return 'medical card';
            default:
                return 'ID card';
        }
    }

    render() {
        if (this.state.processing) {
            return <Processing />
        }
        return (
            <Fragment>

                <Header />

                <div className='body column capture_photo'>

                    <div className='row wrapper description_container'>
                        <p className='description'>Upload a clear picture of the {this.getOrientationCopy()} of your {this.getCardTypeCopy()}.</p>
                    </div>

                    <div className="capture_group">

                        <div className='row wrapper capture_container'>


                            {this.props.sidesLeft === 2 &&
                            <img alt='idscango' className={'capture'} src={require('../assets/video/scan_process.gif')} />

                            }
                            {this.props.sidesLeft === 1 &&
                                <img alt='idscango' className={'capture'} src={this.props.frontSubmitted ? require('../assets/images/card_back@3x.png') : require('../assets/images/illustration1@3x.png')} />
                            }

                            <input type="file" accept="image/*" capture="environment" id="camera"
                                   name={'camera'}
                                value={this.state.inputValue}
                                className='hidden'
                                on
                                onChange={this.processImage.bind(this)}
                                ref={this.textInput}
                            />

                        </div>

                        <div className="wrapper column capture_controls">

                            {this.props.sidesLeft === 2 &&
                                <Fragment>
                                    {process.env.REACT_APP_IDPASSPORT_ENABLED === 'true' &&
                                        <label htmlFor="camera" className='btn' onClick={() => this.props.setCardType(1)}>
                                            <p className={'buttonBgText'}>Capture ID/Passport</p>
                                        </label>
                                    }
                                    {process.env.REACT_APP_MEDICAL_CARD_ENABLED === 'true' &&
                                        <label htmlFor="camera" className='btn' onClick={() => this.props.setCardType(2)}>
                                            <p className={'buttonBgText'}>Capture Medical Card</p>
                                        </label>
                                    }
                                </Fragment>
                            }

                            {this.props.sidesLeft === 1 &&
                                <label htmlFor="camera" className={'btn'}>
                                    <p className='buttonBgText'>Capture {this.getOrientationCopy()} of {this.getCardTypeCopy()}</p>
                                </label>
                            }
                            {this.props.sidesLeft === 1 && this.props.cardType === 2 &&
                                <div className={'btn outline'} onClick={() => { this.props.history.push('/results/medicard') }}>
                                    <p className={'buttonBdText'}>Skip this step</p>
                                </div>
                            }

                        </div>

                    </div>

                </div>

            </Fragment>
        );
    }
}

function mapStateToProps(state) {
    return {
        instanceID: state.config.instanceID,
        orientation: state.idProperties.orientation,
        cardType: state.idProperties.cardType,
        sidesLeft: state.idProperties.sidesLeft,
        frontSubmitted: state.config.frontSubmitted,
        backSubmitted: state.config.backSubmitted
    };
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({ setCardType, setInstanceID, setCardOrientation, decrementSidesLeft, submitFrontID, submitBackID }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(CapturePhoto);