const express = require('express');
const router = express.Router();

const uuid = require('uuid').v4;
const _ = require('lodash');
const verifier = require('./verifier')
// require('dotenv').config();

class Directive {
    constructor({namespace, name, payload}) {
        this.header = {
            messageId: uuid(),
            namespace: namespace,
            name: name,
        }
        this.payload = payload
    }
}

function resultText({midText, sum, diceCount}) {
    if (diceCount == 1) {
        return `結果は ${sum} です。`
    } else if (diceCount < 4) {
        return `結果は ${midText} で、合計 ${sum} です。`
    } else {
        return `${diceCount}個のサイコロの合計は ${sum} です。`
    }
}

function throwDice(diceCount) {
    const results = []
    let midText = ''
    let resultText = ''
    let sum = 0
    console.log(`throw ${diceCount} times`)
    for (let i = 0; i < diceCount; i++) {
        const rand = Math.floor(Math.random() * 6) + 1
        console.log(`${i + 1} time: ${rand}`)
        results.push(rand)
        sum += rand
        midText += `${rand}, `
    }

    midText = midText.replace(/, $/, '')
    return {midText, sum, diceCount}
}

class CEKRequest {
    constructor (httpReq) {
        this.request = httpReq.body.request
        this.context = httpReq.body.context
        this.session = httpReq.body.session
        console.log(`CEK Request: ${JSON.stringify(this.context)}, ${JSON.stringify(this.session)}`)
    }

    do(cekResponse) {
        switch (this.request.type) {
            case 'LaunchRequest':
                return this.launchRequest(cekResponse)
            case 'IntentRequest':
                return this.intentRequest(cekResponse)
            case 'SessionEndedRequest':
                return this.sessionEndedRequest(cekResponse)
        }
    }

    launchRequest(cekResponse) {
        console.log('launchRequest')
        cekResponse.setSimpleSpeechText('こんにちは．')
        cekResponse.setMultiturn({
            // intent: 'ThrowDiceIntent',
        })
    }

    intentRequest(cekResponse) {
        console.log('intentRequest')
        console.dir(this.request)
        const intent = this.request.intent.name
        const slots = this.request.intent.slots

        switch (intent) {
        case 'ThrowDiceIntent':
            let diceCount = 1
            if (slots != null && slots.diceCount != null) {
                diceCount = parseInt(slots.diceCount.value);
            }
            cekResponse.appendSpeechText(`サイコロを ${diceCount}個 投げます。`)
            cekResponse.appendSpeechText({
                lang: 'ja',
                type: 'URL',
                value: `${process.env.DOMAIN}/rolling_dice_sound.mp3`,
            })
            const throwResult = throwDice(diceCount)
            cekResponse.appendSpeechText(resultText(throwResult));
            break
        case 'FortuneTellingIntent':
            let fortuneSlot = '運勢';
            console.log(slots.FortuneSlot);
            if (slots != null && slots.FortuneSlot != null) {
                fortuneSlot = slots.FortuneSlot.value;
            }
            cekResponse.appendSpeechText(`あなたの${fortuneSlot}は大吉です！`)
            break;
        case 'TiredIntent':
            let placeSlot = '';
            console.log(slots.PlaceSlot);
            if (slots != null && slots.PlaceSlot != null) {
                placeSlot = slots.PlaceSlot.value;
            }
            switch (placeSlot) {
            case '学校':
                cekResponse.appendSpeechText(`いつも頑張ってるから弱音吐いてもいいよ`)
                break;
            default:
                cekResponse.appendSpeechText(`つらい時こそ笑顔が大切だよ！`)
                break;
            }
            break;
        }

        cekResponse.setMultiturn({
            // intent: 'ThrowDiceIntent',
        })

        if (this.session.new == false) {
            cekResponse.setMultiturn()
        }
    }

    sessionEndedRequest(cekResponse) {
        console.log('sessionEndedRequest')
        cekResponse.setSimpleSpeechText('サイコロを終了します。')
        cekResponse.clearMultiturn()
    }
}

class CEKResponse {
    constructor () {
        console.log('CEKResponse constructor')
        this.response = {
            directives: [],
            shouldEndSession: true,
            outputSpeech: {},
            card: {},
        }
        this.version = '0.1.0'
        this.sessionAttributes = {}
    }

    setMultiturn(sessionAttributes) {
        this.response.shouldEndSession = false
        this.sessionAttributes = _.assign(this.sessionAttributes, sessionAttributes)
    }

    clearMultiturn() {
        this.response.shouldEndSession = true
        this.sessionAttributes = {}
    }

    setSimpleSpeechText(outputText) {
        this.response.outputSpeech = {
            type: 'SimpleSpeech',
            values: {
                    type: 'PlainText',
                    lang: 'ja',
                    value: outputText,
            },
        }
    }

    appendSpeechText(outputText) {
        const outputSpeech = this.response.outputSpeech
        if (outputSpeech.type != 'SpeechList') {
            outputSpeech.type = 'SpeechList'
            outputSpeech.values = []
        }
        if (typeof(outputText) == 'string') {
            outputSpeech.values.push({
                type: 'PlainText',
                lang: 'ja',
                value: outputText,
            })
        } else {
            outputSpeech.values.push(outputText)
        }
    }
}

const clovaReq = function (httpReq, httpRes, next) {
    const signature = httpReq.headers.signaturecek
    cekResponse = new CEKResponse()
    cekRequest = new CEKRequest(httpReq)
    try{
        verifier(signature, process.env.ExtensionId, JSON.stringify(httpReq.body))
    }catch(e){
        return httpRes.status(400).send(e.message)
    }
    cekRequest.do(cekResponse)
    console.log(`CEKResponse: ${JSON.stringify(cekResponse)}`)
    return httpRes.send(cekResponse)
};

router.post(`/`, clovaReq);
module.exports = router;
