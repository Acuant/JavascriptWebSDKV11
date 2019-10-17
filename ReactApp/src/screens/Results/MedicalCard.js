import React, {Component, Fragment} from 'react';
import {Redirect} from "react-router-dom";
import moment from "moment";
import {connect} from "react-redux";
import Processing from "./../Processing";
import {bindActionCreators} from "redux";
import {processMedicard} from "./../actions/processDataActions";
import {resetProcessedData} from "../actions/processDataActions";
import {resetConfig} from "../actions/configActions";
import {resetIDProperties} from "../actions/idPropertiesActions";
import Header from "../Header";

class MedicalCard extends Component{

    constructor(props) {
        super(props);
    }

    componentDidMount() {
        let {instanceID} = this.props;
        this.props.processMedicard({
            instanceID: instanceID,
            subscriptionID: process.env.REACT_APP_SUBSCRIPTION_ID
        });
    }

    resetStoreAndRedirect() {
        this.props.resetConfig();
        this.props.resetIDProperties();
        this.props.resetProcessedData();
        this.props.history.push('/');
    }

    render() {
        if (!this.props.resultData) {
            return <Processing/>
        }
        return(
            <Fragment>

                <Header/>

                {this.props.resultData &&

                <div className='body column results'>

                    <div className='wrapper'>

                        <div className='row results_id_sig'>

                            <figure class='results_medcard'>
                                {this.props.resultData['FrontImage'] && this.props.resultData['FrontImage'].length > 0 && <img alt='idscango' className={'medical-card-front'} src={this.props.resultData['FrontImage']}/>}
                            </figure>

                            <figure class='results_medcard'>
                                {this.props.resultData['BackImage'] && this.props.resultData['BackImage'].length > 0 && <img alt='idscango' className={'medical-card-back'} src={this.props.resultData['BackImage']}/>}
                            </figure>

                        </div>

                        <div className='results_data'>

                            <ul>

                                {Object.keys(this.props.resultData).map(key => {
                                    if(this.props.resultData[key] && this.props.resultData[key].length > 0
                                        && typeof this.props.resultData[key] !== 'object'
                                        && key !== 'FrontImage'
                                        && key !== 'BackImage'
                                        && key !== 'RawText'
                                        && key !== 'TransactionTimestamp'
                                        && key !== 'MemberName') {
                                            return <div className='row' key={key}>
                                                <div className='type'>{key.match(/[A-Z][a-z]+|[0-9]+/g).join(" ")}</div>
                                                <div className='data'>{this.props.resultData[key]}</div>
                                            </div>
                                    }
                                    if (this.props.resultData[key] && this.props.resultData[key].length > 0 && typeof this.props.resultData[key] === 'object') {
                                        return this.props.resultData[key].map(collapsedObject => {
                                            if (collapsedObject.Label && collapsedObject.Label.length > 0) {
                                                return <div className='row'>
                                                    <div className='type'>{collapsedObject.Label}</div>
                                                    <div className='data'>{collapsedObject.Value}</div>
                                                </div>
                                            }
                                            if (!('Label' in collapsedObject)) {
                                                return Object.keys(collapsedObject).map(collapsedObjectKey => {
                                                    if (collapsedObject[collapsedObjectKey] && collapsedObject[collapsedObjectKey].length > 0) {
                                                        return <div className='row'>
                                                            <div className='type'>{collapsedObjectKey.match(/[A-Z][a-z]+|[0-9]+/g).join(" ")}</div>
                                                            <div className='data'>{collapsedObject[collapsedObjectKey]}</div>
                                                        </div>
                                                    }
                                                });
                                            }
                                        });

                                    }
                                })}

                            </ul>

                        </div>

                        <a className='btn outline' onClick={() => this.resetStoreAndRedirect()}>
                            <p className={'buttonBgText'}>Home</p>
                        </a>

                    </div>

                </div>

                }

            </Fragment>
        )
    }
}

function mapStateToProps(state) {
    return {
        instanceID: state.config.instanceID,
        faceMatch: state.processedData.faceMatch,
        resultData: state.processedData.result,
        cardType: state.idProperties.cardType
    }
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({processMedicard, resetProcessedData, resetConfig, resetIDProperties}, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(MedicalCard);