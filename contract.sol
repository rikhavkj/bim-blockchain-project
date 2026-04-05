// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BIMStorage {

    struct File {
        string fileName;
        string fileHash;
        string ipfsCID;
        bool isDeleted;
        address owner;
        mapping(address => bool) access;
    }

    mapping(uint => File) public files;
    uint public fileCount;

    // Upload file details
    function uploadFile(string memory _name, string memory _hash, string memory _cid) public {
        fileCount++;
        files[fileCount].fileName = _name;
        files[fileCount].fileHash = _hash;
        files[fileCount].ipfsCID = _cid;
        files[fileCount].isDeleted = false;
        files[fileCount].owner = msg.sender;
        files[fileCount].access[msg.sender] = true;
    }

    // Grant access to another user
    function grantAccess(uint fileId, address user) public {
        require(msg.sender == files[fileId].owner);
        files[fileId].access[user] = true;
    }

    // Check if user has access
    function checkAccess(uint fileId) public view returns (bool) {
        return files[fileId].access[msg.sender];
    }

     // Get file hash (only if allowed)
    function getFile(uint fileId) public view returns (string memory, string memory) {
        require(!files[fileId].isDeleted, "File deleted");
        require(files[fileId].access[msg.sender]);
        return (files[fileId].fileHash, files[fileId].ipfsCID);
    }

    function deleteFile(uint fileId) public {
        require(msg.sender == files[fileId].owner, "Not owner");
        files[fileId].isDeleted = true;
    }
}