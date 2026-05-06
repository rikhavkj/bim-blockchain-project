let web3;
let contract;
let account;

const contractAddress = "0x0657BbC24Ae9176c6c5De9cf660c3f18625797F7";

// 👉 Paste ABI here
const abi = [
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "fileId",
				"type": "uint256"
			}
		],
		"name": "checkAccess",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "fileId",
				"type": "uint256"
			}
		],
		"name": "deleteFile",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "fileCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "files",
		"outputs": [
			{
				"internalType": "string",
				"name": "fileName",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "fileHash",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "ipfsCID",
				"type": "string"
			},
			{
				"internalType": "bool",
				"name": "isDeleted",
				"type": "bool"
			},
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "fileId",
				"type": "uint256"
			}
		],
		"name": "getFile",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "fileId",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "user",
				"type": "address"
			}
		],
		"name": "grantAccess",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "_name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_hash",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "_cid",
				"type": "string"
			}
		],
		"name": "uploadFile",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]

async function connectWallet() {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    account = accounts[0];

    document.getElementById("account").innerText = account;

    contract = new web3.eth.Contract(abi, contractAddress);
    console.log(contract.methods);

	loadFiles();
  } else {
    alert("Install MetaMask Wallet Extension!");
  }
}

async function uploadFile() {

  const file = document.getElementById("fileInput").files[0];

  if (!file) {
    document.getElementById("uploadResult").innerHTML = "❌ Select file first";
    return;
  }

  document.getElementById("uploadResult").innerHTML = "🔐 Encrypting...";

  try {

    const { encryptedFile, key, iv } = await encryptFile(file);

    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    document.getElementById("uploadResult").innerHTML = "☁️ Uploading to IPFS...";

    const cid = await uploadToIPFS(encryptedFile);

    document.getElementById("uploadResult").innerHTML = "⛓️ Storing on blockchain...";

	const fileName = file.name;
    await contract.methods.uploadFile(fileName, hashHex, cid)
      .send({ from: account });

    // 🔑 Download key file
    const keyData = `KEY:${key}\nIV:${iv}`;
    const blob = new Blob([keyData], { type: "text/plain" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    a.download = `decryption_key_${safeFileName}.txt`;
    a.click();

    document.getElementById("uploadResult").innerHTML =
      `✅ Upload Complete! <br>
       CID: ${cid} <br>
       ⚠️ Key downloaded. Save it safely!`;

    loadFiles();

  } catch (err) {
    console.error(err);
    document.getElementById("uploadResult").innerHTML = "❌ Upload failed";
  }
}

async function encryptFile(file) {

  const buffer = await file.arrayBuffer();

  // Generate random key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    buffer
  );

  // Export key
  const exportedKey = await crypto.subtle.exportKey("raw", key);

  return {
    encryptedFile: new Blob([encrypted]),
    key: btoa(String.fromCharCode(...new Uint8Array(exportedKey))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

async function decryptFile(cid, keyBase64, ivBase64, fileName) {

  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  const encryptedBuffer = await response.arrayBuffer();

  const keyBuffer = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encryptedBuffer
  );

  const blob = new Blob([decrypted]);
  const url = URL.createObjectURL(blob);

  // 👇 Show options
  document.getElementById("fileResult").innerHTML = `
    ✅ Decryption Successful <br><br>
    <button class="btn btn-success" onclick="viewBlob('${url}')">View File</button>
    <button class="btn btn-primary" onclick="downloadBlob('${url}', '${fileName}')">Download File</button>
  `;
}

function viewBlob(url) {
  window.open(url);
}

function downloadBlob(url, fileName) {

  const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");

  const a = document.createElement("a");
  a.href = url;
  a.download = `decrypted_${safeFileName}`;
  a.click();
}

function askDecrypt(cid) {
  const key = prompt("Enter decryption key:");
  const iv = prompt("Enter IV:");

  decryptFile(cid, key, iv);
}

async function uploadToIPFS(file) {

  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";

  const data = new FormData();
  data.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      pinata_api_key: "f1010c6770d93b511d7b",
      pinata_secret_api_key: "40c425b52855f51179e75ace78421bfa489f0413610d322686ffb6014ed168eb"
    },
    body: data
  });

  const result = await response.json();

  return result.IpfsHash;
}

async function generateHash() {
  const file = document.getElementById("fileInput").files[0];

  if (!file) {
    alert("Select a file first!");
    return;
  }

  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  document.getElementById("generatedHash").innerText = hashHex;
}

async function grantAccess() {
  const fileId = document.getElementById("fileId").value;
  const user = document.getElementById("userAddress").value;

  await contract.methods.grantAccess(fileId, user)
    .send({ from: account });

  alert("Access granted!");
}

async function getFile() {

  const fileId = document.getElementById("getFileId").value;

  const result = await contract.methods.getFile(fileId)
    .call({ from: account });

  const cid = result[1];

  const key = prompt("Enter key:");
  const iv = prompt("Enter IV:");

  const fileData = await contract.methods.files(fileId).call();
  decryptFile(cid, key, iv, fileData.fileName);
}

async function viewFile(fileId) {

  try {
    const result = await contract.methods.getFile(fileId)
      .call({ from: account });

    const cid = result[1];
    const fileName = (await contract.methods.files(fileId).call()).fileName;

    const key = prompt("Enter decryption key:");
    const iv = prompt("Enter IV:");

    if (!key || !iv) {
      document.getElementById("fileResult").innerHTML = "❌ Key/IV required";
      return;
    }

    document.getElementById("fileResult").innerHTML = "🔓 Decrypting...";

    await decryptFile(cid, key, iv, fileName);

  } catch (err) {
    console.error(err);
    document.getElementById("fileResult").innerHTML = "❌ Access denied or error";
  }
}

async function grantUI(fileId) {

  const userAddress = prompt("Enter address to grant access:");

  if (!userAddress) {
    document.getElementById("accessResult").innerHTML = "❌ Address required";
    return;
  }

  try {
    document.getElementById("accessResult").innerHTML = "⏳ Granting access...";

    await contract.methods.grantAccess(fileId, userAddress)
      .send({ from: account });

    document.getElementById("accessResult").innerHTML =
      "✅ Access granted successfully";

  } catch (err) {
    console.error(err);
    document.getElementById("accessResult").innerHTML =
      "❌ Grant failed (check address)";
  }
}

async function deleteFile(fileId) {

  if (!confirm("Are you sure you want to delete this file?")) return;

  try {
    await contract.methods.deleteFile(fileId)
      .send({ from: account });

    document.getElementById("accessResult").innerHTML =
      "🗑️ File deleted successfully";

    loadFiles();

  } catch (err) {
    console.error(err);
    document.getElementById("accessResult").innerHTML =
      "❌ Delete failed";
  }
}

async function loadFiles() {

  const count = await contract.methods.fileCount().call();

  let table = "";

  for (let i = 1; i <= count; i++) {

    try {
      const hasAccess = await contract.methods.checkAccess(i)
        .call({ from: account });

      if (!hasAccess) continue;

      const result = await contract.methods.files(i).call();

	  if (result.isDeleted) continue;

	  const cid = result.ipfsCID;
	  const shortCID = cid.slice(0,6) + "..." + cid.slice(-4);
	  const fileName = result.fileName || "Unknown";

      table += `
        <tr>
		  <td>${i}</td>
		  <td>${fileName}</td>
		  <td title="${cid}">${shortCID} <button onclick="navigator.clipboard.writeText('${cid}')">Copy</button></td>
		  <td>
      <!--<button class="btn btn-sm btn-success" onclick="viewFile(${i})">View</button>-->
      <!--     <button class="btn btn-sm btn-warning" onclick="grantUI(${i})">Grant</button>-->
			<button class="btn btn-sm btn-danger" onclick="deleteFile(${i})">Delete</button>
          </td>
        </tr>
      `;

    } catch {}
  }

  document.getElementById("fileTable").innerHTML = table;
}