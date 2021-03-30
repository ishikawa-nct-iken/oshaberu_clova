const express = require('express');
const router = express.Router();

const uuid = require('uuid').v4;
const _ = require('lodash');
const verifier = require('./verifier');
const fs = require('fs');

const responses = JSON.parse(fs.readFileSync('./data/json/responses_senior.json', 'utf8'));

class Directive {
    constructor({namespace, name, payload}) {
        this.header = {
            messageId: uuid(),
            namespace: namespace,
            name: name,
        };
        this.payload = payload;
    }
}

const getSlot = (slots, name, defaultVal) => {
    if (slots != null && slots[name] != null) {
        return slots[name].value;
    }

    return defaultVal ? defaultVal : null;
}

const chooseFromArray = (array) => {
    if (!array || array.length == 0) {
        return null;
    }

    const rnd = Math.floor(Math.random() * array.length);
    return array[rnd];
};

const getResponse = (intent, slots) => {
    for (const intentName of Object.keys(responses)) {
        if (intent === intentName) {
            if (typeof responses[intentName] == 'string') {
                return response[intentName];
            } else if (Array.isArray(responses[intentName])) {
                return chooseFromArray(responses[intentName]);
            } else {
                const res = getResponseSlot(responses[intentName], slots);
                if (res) {
                    return res;
                }
            }
        }
    }
    if (responses.hasOwnProperty('')) {
        return chooseFromArray(responses['']);
    }
};

const getResponseSlot = (responses, slots) => {
    if (slots != null) {
        for (const slotName of Object.keys(responses)) {
            if (slots.hasOwnProperty(slotName)) {
                for (const value of Object.keys(responses[slotName])) {
                    if (value === slots[slotName].value) {
                        if (typeof responses[slotName][value] == 'string') {
                            return response[slotName][value];
                        } else if (Array.isArray(responses[slotName][value])) {
                            return chooseFromArray(responses[slotName][value]);
                        } else {
                            const res = getResponseSlot(responses[slotName][value], slots);
                            if (res) {
                                return res;
                            }
                        }
                    }
                }
            }
        }
    }
    if (responses.hasOwnProperty('')) {
        return chooseFromArray(responses['']);
    }
};

class CEKRequest {
    constructor (httpReq) {
        this.request = httpReq.body.request;
        this.context = httpReq.body.context;
        this.session = httpReq.body.session;
        console.log(`CEK Request: ${JSON.stringify(this.context)}, ${JSON.stringify(this.session)}`);
    }

    do(cekResponse) {
        switch (this.request.type) {
            case 'LaunchRequest':
                return this.launchRequest(cekResponse);
            case 'IntentRequest':
                return this.intentRequest(cekResponse);
            case 'SessionEndedRequest':
                return this.sessionEndedRequest(cekResponse);
        }
    }

    launchRequest(cekResponse) {
        console.log('launchRequest');
        cekResponse.setSimpleSpeechText('こんにちは．おしゃべるです．');
        cekResponse.setMultiturn();
    }

    intentRequest(cekResponse) {
        console.log('intentRequest');
        console.dir(this.request);
        const intent = this.request.intent.name;
        const slots = this.request.intent.slots;

        switch (intent) {
        case 'ThrowDiceIntent':
            let diceCount = 1;
            if (slots != null && slots.diceCount != null) {
                diceCount = parseInt(slots.diceCount.value);
            }
            let sum = 0;
            for (let i = 0; i < diceCount; i++) {
                sum += Math.floor(Math.random() * 6) + 1;
            }
            cekResponse.appendSpeechText(`サイコロを ${diceCount}個 投げます。`);
            cekResponse.appendSpeechText({
                lang: 'ja',
                type: 'URL',
                value: `${process.env.DOMAIN}/sounds/saikoro.mp3`,
            });
            cekResponse.appendSpeechText(`${diceCount}個のサイコロの合計は ${sum} です。`);
            break;

        default:
            cekResponse.appendSpeechText(getResponse(intent, slots));
            break;
        }

        cekResponse.setMultiturn();
        // if (this.session.new == false) {
        //     cekResponse.setMultiturn()
        // }
    }

    sessionEndedRequest(cekResponse) {
        console.log('sessionEndedRequest');
        cekResponse.setSimpleSpeechText('おしゃべるを終了します。');
        cekResponse.clearMultiturn();
    }
}

class CEKResponse {
    constructor () {
        console.log('CEKResponse constructor');
        this.response = {
            directives: [],
            shouldEndSession: true,
            outputSpeech: {},
            card: {},
        };
        this.version = '0.1.0';
        this.sessionAttributes = {};
    }

    setMultiturn(sessionAttributes) {
        this.response.shouldEndSession = false;
        this.sessionAttributes = _.assign(this.sessionAttributes, sessionAttributes);
    }

    clearMultiturn() {
        this.response.shouldEndSession = true;
        this.sessionAttributes = {};
    }

    setSimpleSpeechText(outputText) {
        this.response.outputSpeech = {
            type: 'SimpleSpeech',
            values: {
                    type: 'PlainText',
                    lang: 'ja',
                    value: outputText,
            },
        };
    }

    appendSpeechText(outputText) {
        const outputSpeech = this.response.outputSpeech;
        if (outputSpeech.type != 'SpeechList') {
            outputSpeech.type = 'SpeechList';
            outputSpeech.values = [];
        }
        if (typeof(outputText) == 'string') {
            outputSpeech.values.push({
                type: 'PlainText',
                lang: 'ja',
                value: outputText,
            });
        } else {
            outputSpeech.values.push(outputText);
        }
    }
}

const clovaReq = (httpReq, httpRes, next) => {
    const signature = httpReq.headers.signaturecek;
    const cekResponse = new CEKResponse();
    const cekRequest = new CEKRequest(httpReq);
    try{
        verifier(signature, process.env.EXTENSION_ID, JSON.stringify(httpReq.body));
    } catch(e) {
        return httpRes.status(400).send(e.message);
    }
    cekRequest.do(cekResponse);
    console.log(`CEKResponse: ${JSON.stringify(cekResponse)}`);
    return httpRes.send(cekResponse);
};

router.post(`/`, clovaReq);
module.exports = router;
