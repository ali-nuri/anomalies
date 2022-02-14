const fs = require('fs')
const transactions = require('./txs.json')
const { quantile } = require('simple-statistics')
const express = require('express')
const path = require('path')

function getAnomalies() {
    const transactionsProcessed = []
    const differences = []

    let idx = 0;
    for (let tx of transactions) {
        const txProcessed = {
            index: idx++,
            txId: tx.id,
            transferedAmount: tx.amount.quantity,
            inputCount: tx.inputs.length,
            outputCount: tx.outputs.length,
            inputSum: calculateInputSum(tx.inputs),
            outputSum: calculateOutputSum(tx.outputs),
            fee: tx.fee?.quantity ?? 0,
            date: tx.inserted_at.time
        }

        if (txProcessed.inputSum === 0) {
            console.warn('cannot process tx with id: ' + tx.id + ' because input amount is not defined')
            continue
        }

        if (!inOutQuantityEqual(txProcessed)) {
            differences.push(txProcessed)
        }

        transactionsProcessed.push(txProcessed)
    }

    const quartiles = calculateQuartiles(transactionsProcessed)

    const outliers = calculateOutliers(transactionsProcessed, quartiles)

    return {
        outliers: { outliers, upperBound: quartiles.upper, lowerBound: quartiles.lower },
        differences
    }
}

function calculateInputSum(t) {
    return t.reduce((acc, cur) => acc + (cur.amount?.quantity ?? 0), 0)
}

function calculateOutputSum(t) {
    return t.reduce((acc, cur) => acc + (cur.amount?.quantity ?? 0), 0)
}

function inOutQuantityEqual(txp) {
    return txp.inputSum === txp.outputSum + txp.fee
}

function calculateQuartiles(txps) {
    const values = txps.map(txp => txp.transferedAmount)
    const [q1, q3] = quantile(values, [0.25, 0.75])
    const iqr = q3 - q1
    const lower = q1 - 1.5 * iqr
    const upper = q3 + 1.5 * iqr

    return { iqr, lower, upper }
}

function calculateOutliers(txps, quartiles) {
    return txps.filter(txp => txp.transferedAmount < quartiles.lower || txp.transferedAmount > quartiles.upper)
}


const app = express()

app.get('/anomalies', (req, res) => {
    res.json(getAnomalies())
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './view/index.html'))
})

app.listen(3000, () => console.log('listening on 3000, visit this URL http://localhost:3000'))