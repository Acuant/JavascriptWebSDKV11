#!/bin/bash

#Convert to absolute url for use with CDNs
#$1=file location
#$2=absolute url
#$3=optional regex override
#Sergey Maltsev


if [ -z "$1" ] 
then
	echo "Specify File Location."
	exit 1
else
	if ! [[ -f "$1" ]] 
	then
		echo "Param 1 was not a file."
		exit 1
	fi
fi

if [ -z "$2" ] 
then
	echo "Specify Absolute Url."
	exit 1
fi

if [ "$3" != "-f" ] 
then
	if ! [[ "$2" =~ ^https://.+/AcuantImageProcessingWorker\.wasm$ ]] 
	then
		echo "URL did not match regex, double check and add -f to override."
		exit 1
	fi
else
	echo "Bypassing URL checks."
fi

if [ -n "$4" ] 
then 
	echo "Too Many Params."
	exit 1
fi

FILE="$1"
URL="$2"

sed -i.backup 's|wasmBinaryFile="AcuantImageProcessingWorker.wasm"|wasmBinaryFile="'"${URL}"'"|g' "$FILE"

echo "Done"
exit 0