import asyncio
import csv
import hashlib
import json
import socket
from time import strftime, localtime
import base58
import sys
import os

port = 50001
host = 'localhost'

def get_script_hash(addr):
    decoded_address = base58.b58decode_check(addr)
    pubkey_hash = decoded_address[1:]
    script_pub_key = b"\x76\xa9\x14" + pubkey_hash + b"\x88\xac"
    script_hash = hashlib.sha256(script_pub_key).digest()
    return script_hash[::-1].hex(), script_pub_key

global_sock = None

async def fetch_transaction_details(tx, addr):
    tx_hash = tx['tx_hash']
    content = {
        "method": "blockchain.transaction.get",
        "params": [tx_hash, True],
        "id": 0
    }
    tx_response = json.loads(electrumx(host, port, content))

    if 'result' in tx_response and isinstance(tx_response['result'], dict) and 'vout' in tx_response['result']:
        received_amount = 0
        sent_amount = 0

        for vout in tx_response['result']['vout']:
            if 'addresses' in vout['scriptPubKey'] and addr in vout['scriptPubKey']['addresses']:
                received_amount += vout['value']
            elif 'addresses' in vout['scriptPubKey'] and addr not in vout['scriptPubKey']['addresses']:
                sent_amount += vout['value']

        tx_time = tx_response['result']['time']
        human_readable_time = strftime("%Y-%m-%d %H:%M:%S", localtime(tx_time))
        tx_txid = tx_response['result']['txid']
        if received_amount > 0:
            transactions.append({"Date": human_readable_time, "Sent Amount": None, "Sent Currency": None, "Received Amount": received_amount, "Received Currency": "AIPG", "TxHash": tx_txid})
        else:
            transactions.append({"Date": human_readable_time, "Sent Amount": sent_amount, "Sent Currency": "AIPG", "Received Amount": None, "Received Currency": None, "TxHash": tx_txid})
    else:
        print("Transaction details not found or invalid response:", tx_response)

async def main():
    tasks = []
    for tx in history_response['result']:
        task = asyncio.create_task(fetch_transaction_details(tx, addr))
        tasks.append(task)
    await asyncio.gather(*tasks)

def electrumx(host, port, content):
    global global_sock

    if not global_sock:
        global_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        global_sock.connect((host, port))

    global_sock.sendall(json.dumps(content).encode('utf-8') + b'\n')

    res = ""
    while True:
        data = global_sock.recv(1024)
        if not data:
            break
        res += data.decode()
        if res.endswith('\n'):
            break
    return res

def save_to_csv(data, filename):
    with open(filename, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=['Date', 'Sent Amount', 'Sent Currency', 'Received Amount', 'Received Currency', 'TxHash'])
        writer.writeheader()
        for row in data:
            writer.writerow(row)

if __name__ == "__main__":
    addr = sys.argv[1]

    script_hash, _ = get_script_hash(addr)
    content = {
        "method": "blockchain.scripthash.get_history",
        "params": [script_hash],
        "id": 0
    }
    history_response = json.loads(electrumx(host, port, content))
    transactions = []

    asyncio.run(main())

    save_to_csv(transactions, "./public/AIPG-transactions.csv")
