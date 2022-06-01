// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC721/extensions/ERC721Enumerable.sol)

pragma solidity ^0.8.0;

import "./ISaeNft.sol";
import "./ISaeStakingErc721Transfer.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract SaeNft is ERC721Enumerable, ISaeNft, Ownable
{
    uint256 private nonce = 0;

    ISaeStakingErc721Transfer private _contract;

    // Optional mapping for token URIs
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("SaeNft", "DAGNFT") {}

    /**
     * @dev Set proxy contract.
     */
    function setProxy(address addr) external virtual onlyOwner {
        _contract = ISaeStakingErc721Transfer(addr);
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override (IERC721, ERC721) virtual {
        //solhint-disable-next-line max-line-length
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _contract.transferErc721(to, tokenId);
        _transfer(from, to, tokenId);
    }

    /**
     * @dev Safely mints `tokenId` and transfers it to `to`.
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeMint(address to, string memory _tokenURI) external virtual onlyOwner {
        uint256 tokenId = uint256(keccak256(abi.encodePacked(nonce)));
        _safeMint(to, tokenId, "");
        _setTokenURI(tokenId, _tokenURI);
        nonce += 1;
    }

    /**
     * @dev Retrieves next auto-generated `tokenId`.
     */
    function nextTokenId() public view virtual returns (uint256) {
        return uint256(keccak256(abi.encodePacked(nonce)));
    }

  /**
    * @dev Executes IERC721Enumerable-tokenOfOwnerByIndex.
     */
    function getTokenOwnerByIndex(address owner, uint256 index) public view virtual override returns (uint256) {
        return tokenOfOwnerByIndex(owner, index);
    }

    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */
    function exists(uint256 tokenId) external view virtual override returns (bool) {
        return _exists(tokenId);
    }

    /**
     * @dev See {IERC721-balanceOf}.
     */
    function numberNftsOwned(address owner) public view virtual returns (uint256) {
        return balanceOf(owner);
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function burn(uint256 tokenId) external virtual override {
        _burn(tokenId);
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721URIStorage: URI query for nonexistent token");

        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();

        // If there is no base URI, return the token URI.
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }

        return super.tokenURI(tokenId);
    }

    /**
     * @dev Retrieves next auto-generated `tokenId`.
     */
    function setTokenURI(uint256 tokenId, string memory _tokenURI) external virtual {
        _setTokenURI(tokenId, _tokenURI);
    }

    /**
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_exists(tokenId), "ERC721URIStorage: URI set of nonexistent token");
        _tokenURIs[tokenId] = _tokenURI;
    }

    /**
     * @dev See {ERC721-_burn}. This override additionally checks to see if a
     * token-specific URI was set for the token, and if so, it deletes the token URI from
     * the storage mapping.
     */
    function _burn(uint256 tokenId) internal virtual override {
        super._burn(tokenId);

        if (bytes(_tokenURIs[tokenId]).length != 0) {
            delete _tokenURIs[tokenId];
        }
    }
}