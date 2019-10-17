import React, {Component, Fragment} from 'react';
import {Redirect} from 'react-router-dom';
import {connect} from "react-redux";
import {bindActionCreators} from "redux";
import {resetProcessedData} from "../actions/processDataActions";
import {resetConfig} from "../actions/configActions";
import {resetIDProperties} from "../actions/idPropertiesActions";

class DefaultError extends Component {

    constructor(props) {
        super(props);

        this.state = {
            retryLastStep: false
        };

        this.retry = this.retry.bind(this);
    }

    retry() {
        if (!this.state.retryLastStep) {
            this.props.resetConfig();
            this.props.resetIDProperties();
            this.props.resetProcessedData();
            this.props.history.push('/');
        } else {
            this.props.history.goBack();
        }
    }

    componentDidMount() {
        let {history} = this.props;
        if (history && history.location && history.location.state) {
            this.setState({
                retryLastStep: history.location.state.retryLastStep
            })
        }
    }

    render() {
        return (
            <Fragment>
                <div className='body column'>
                    <div className='wrapper'>
                        <div className='column description_container'>
                            <img alt='idscango' className='icon' src={require('../../assets/images/icon_attention@2x.png')}/>
                            <p className='description'>Unable to detect ID.</p>
                        </div>
                        <div className='instructions'>
                            <ul>
                                <li>Place ID close to device.</li>
                                <li>Ensure sufficient light.</li>
                                <li>Hold device steady.</li>
                                <li>Make sure all edges of the ID are visible.</li>
                                <li>Make sure there are no glare and shadows on the ID.</li>
                            </ul>
                            <div className='example_list'>
                                <div className='example'>
                                    <img alt='idscango' className='image' src={require('../../assets/images/image_correct.jpg')}/>
                                    <div className="example_text">
                                        <img alt='idscango' className='icon' src={require('../../assets/images/icon_checked@2x.png')}/>
                                        <p>correct</p>
                                    </div>
                                </div>
                                <div className='example'>
                                    <img alt='idscango' className='image' src={require('../../assets/images/image_incorrect.jpg')}/>
                                    <div className="example_text">
                                        <img alt='idscango' className='icon' src={require('../../assets/images/icon_attention@2x.png')}/>
                                        <p>incorrect</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={'btn'} onClick={this.retry} >
                            <p className={'buttonBdText'}>Retry</p>
                        </div>
                    </div>
                </div>
            </Fragment>
        );
    }
}

function mapStateToProps(state) {
    return state;
}

function mapDispatchToProps(dispatch) {
    return bindActionCreators({resetProcessedData, resetConfig, resetIDProperties}, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(DefaultError);