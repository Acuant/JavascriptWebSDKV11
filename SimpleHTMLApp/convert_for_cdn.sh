#!/bin/bash

#Convert to absolute urls for use with CDNs
#$1=file directory
#$2=absolute url up to file location on CDN including trailing slash (ie https://company.example/files/ but not https://company.example/files/file.wasm or https://company.example/files)
#Sergey Maltsev


if [ -z "$1" ] 
then
	echo "Specify File Location."
	exit 1
else
	if ! [[ -d "$1" ]] 
	then
		echo "Param 1 was not a directory."
		exit 1
	fi
fi

if [ -z "$2" ] 
then
	echo "Specify Absolute Url."
	exit 1
fi

if [ -n "$3" ] 
then 
	echo "Too Many Params."
	exit 1
fi

FILE="$1"
URL=$(echo "$2"|sed 's|/$||')/
echo $URL

sed -i.backup 's|="AcuantInitializerService.wasm"|="'"${URL}"'AcuantInitializerService.wasm"|g' "$FILE/AcuantInitializerService.min.js"
sed -i.backup 's|="AcuantImageService.wasm"|="'"${URL}"'AcuantImageService.wasm"|g' "$FILE/AcuantImageService.min.js"
sed -i.backup 's|="AcuantMetricsService.js.mem"|="'"${URL}"'AcuantMetricsService.js.mem"|g' "$FILE/AcuantMetricsService.min.js"

sed -i.backup 's|importScripts("AcuantInitializerService.min.js")|importScripts("'"${URL}"'AcuantInitializerService.min.js")|g' "$FILE/AcuantInitializerWorker.min.js"
sed -i.backup 's|importScripts("AcuantImageService.min.js")|importScripts("'"${URL}"'AcuantImageService.min.js")|g' "$FILE/AcuantImageWorker.min.js"
sed -i.backup 's|importScripts("AcuantMetricsService.min.js")|importScripts("'"${URL}"'AcuantMetricsService.min.js")|g' "$FILE/AcuantMetricsWorker.min.js"

echo "Done"
exit 0