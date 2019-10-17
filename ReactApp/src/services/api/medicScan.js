import request from '../shared/medicScan';

function getMedicScanResults(data) {
    return request({
        url: `/api/v1/MedicalCard?subscriptionId=${data.subscriptionID}&instanceId=${data.instanceID}`,
        method: 'GET'
    })
}

const MedicScanService = {
    getMedicScanResults
};

export default MedicScanService;