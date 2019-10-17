import React, {Component, Fragment} from 'react';
import Header from "./Header";

export default class Processing extends Component {

    render() {
        return (
            <Fragment>

                <Header />

                <div className='body column analyzing'>

                    <div className='row wrapper description_container'>
                        <p className='description'>Analyzing...</p>
                    </div>

                    <div className="analyzing_group">

                        <div className='row wrapper analyzing_container'>

                            <figure className="analyzing_animation_zone">
                                <img alt='idscango'
                                    className={'id_background'}
                                    src={this.props.orientation ? require('../assets/images/card_back@2x.png') : require('../assets/images/id_front@2x.png') }
                                />
                            </figure>

                        </div>

                    </div>

                </div>

            </Fragment>
        )
    }
}