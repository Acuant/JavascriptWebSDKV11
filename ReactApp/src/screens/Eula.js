import React, { Component, Fragment } from 'react';
import { connect } from "react-redux";
import Header from "./Header";

class EulaPage extends Component {

    constructor(props) {
        super(props);

    }

    componentDidMount() {
  
    }

    getOrientationCopy() {
        return this.props.orientation === 0 ? 'front' : 'back';
    }

    confirmEula(){
        localStorage.setItem('acuantEula', true);
        this.props.history.replace('/capture/photo');
    }

    render() {
        return (
            <Fragment>
                <Header />
                    <div className='body column capture_photo' style={{padding: "0 5% 0 5%"}}>
                        <div>
                            <h1>End User License Agreement</h1>
                        </div>
                        <div style={{margin: "10% 0 10% 0"}}>
                            <p>By activating or otherwise using Acuant software, you accept all the terms and conditions of this agreement. If you do not accept the terms of this agreement, do not accept below. If you proceed to access and use Acuant’s Software, Your use will be deemed to be your unequivocal consent to have Acuant process your personal identifiable information that can be used to identify you (“PII”) and which may also include biometric data. Your PII and biometric data will be used to authenticate the authenticity of the identity document You submitted to Licensor and/or verify that the picture on the identification document is, in fact, the person standing in front of the camera. Acuant will not store your PII or biometric data but rather, after processing a transaction and returning a response to You, Acuant will permanently delete your PII and biometric data from its servers. Should You not want your PII or biometric data used in the manner described above, do not use Licensor’s Software.</p>
                        </div>
                        <Fragment>
                            <label className='btn' onClick={() => this.confirmEula()}>
                                <p className={'buttonBgText'}>Accept</p>
                            </label>
                        </Fragment>
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
export default connect(mapStateToProps, null)(EulaPage);