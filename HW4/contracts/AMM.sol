
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleAMM {
    IERC20 public tokenA;
    IERC20 public tokenB;
    
    uint256 public reserveA;
    uint256 public reserveB;
    
    mapping (address => uint256) public liquidity;
    uint256 public totalLiquidity;
    
    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }
    
    function deposit(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Invalid amounts");

        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        reserveA += amountA;
        reserveB += amountB;

        uint256 liquidityMinted = amountA + amountB;
        liquidity[msg.sender] += liquidityMinted;
        totalLiquidity += liquidityMinted;
    }
    
    function redeem(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Invalid redeem");
        require(amountA <= reserveA && amountB <= reserveB, "Insufficient reserves");

        uint256 redeemAB = (amountA*totalLiquidity/reserveA) + (amountB*totalLiquidity/reserveB);
        require(liquidity[msg.sender] >= redeemAB, "Not enough liquidity");

        liquidity[msg.sender] -= redeemAB;
        totalLiquidity -= redeemAB;
        reserveA -= amountA;
        reserveB -= amountB;

        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);
    }
    
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external {
        require(amountIn > 0, "Invalid input");

        bool isTokenAIn = tokenIn == address(tokenA);
        require(isTokenAIn || tokenIn == address(tokenB), "Invalid token");

        (IERC20 inToken, IERC20 outToken, uint256 reserveIn, uint256 reserveOut) =
            isTokenAIn ? (tokenA, tokenB, reserveA, reserveB) : (tokenB, tokenA, reserveB, reserveA);

        inToken.transferFrom(msg.sender, address(this), amountIn);

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        uint256 amountOut = numerator / denominator;

        require(amountOut >= minAmountOut, "Slippage exceeded");

        outToken.transfer(msg.sender, amountOut);

        if (isTokenAIn) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }
    }
}
