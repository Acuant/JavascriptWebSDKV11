import React, { Component, Fragment } from 'react';
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import Header from "./Header";
import { decrementSidesLeft, setCardOrientation, setCardType } from "./actions/idPropertiesActions";
import { setInstanceID, submitBackID, submitFrontID } from "./actions/configActions";
import Processing from "./Processing";

class CapturePhoto extends Component {

    constructor(props) {
        super(props);
        this.state = {
            inputValue: null,
            processing: false        
        }
    }

    isIEorEDGE() {
        return navigator.appName === 'Microsoft Internet Explorer' || (navigator.appName === "Netscape" && navigator.appVersion.indexOf('Edge') > -1);
    }

    componentDidMount() {
        if (!this.props.instanceID) {
            this.props.setInstanceID();
        }
        if (this.props.location && this.props.location.state) {
            if (this.props.location.state.isRetry) {
                this.navigateCamera();
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

    openCamera(type){
        this.props.setCardType(type);
        this.navigateCamera();
    }

    navigateCamera(){
        this.props.history.push('/capture/camera');
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
                        </div>

                        <div className="wrapper column capture_controls">

                            {this.props.sidesLeft === 2 &&
                                <Fragment>
                                    {process.env.REACT_APP_IDPASSPORT_ENABLED === 'true' &&
                                        <label className='btn' onClick={() => this.openCamera(1)}>
                                            <p className={'buttonBgText'}>Capture ID/Passport</p>
                                        </label>
                                    }
                                    {process.env.REACT_APP_MEDICAL_CARD_ENABLED === 'true' &&
                                        <label className='btn' onClick={() => this.openCamera(2)}>
                                            <p className={'buttonBgText'}>Capture Medical Card</p>
                                        </label>
                                    }
                                </Fragment>
                            }

                            {this.props.sidesLeft === 1 &&
                                <label className={'btn'} onClick={() => this.openCamera(this.props.cardType)} >
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