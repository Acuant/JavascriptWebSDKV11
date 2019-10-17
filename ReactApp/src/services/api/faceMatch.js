import request from '../shared/faceMatchRequest';


function processFaceMatch(data) {
    return request({
        url: '/api/v1/facematch',
        method: 'POST',
        data: data
    });
}

const FaceMatchService = {
    processFaceMatch
};

export default FaceMatchService;