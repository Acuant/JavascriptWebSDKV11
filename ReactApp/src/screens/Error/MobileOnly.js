import React, {Component, Fragment} from 'react';

export default class MobileOnly extends Component {

    constructor(props) {
        super(props);
    }

    render() {
        return(
            <Fragment>
                
                <div className='body column'>

                    <div className='column wrapper description_container desktop_error'>
                        <p className={'description'}>idScan GO Web App is not available for Desktop computers. </p>
                        <p className={'description'}>Please open it on a Mobile device.</p>
                    </div>

                </div>
                
            </Fragment>
        )
    }

}