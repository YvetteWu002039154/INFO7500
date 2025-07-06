const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleAMM", function () {
  let SimpleAMM, MockERC20, amm, tokenA, tokenB;
  let owner, user1, user2, user3;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20Factory.deploy("Token A", "TKA");
    tokenB = await MockERC20Factory.deploy("Token B", "TKB");

    SimpleAMM = await ethers.getContractFactory("SimpleAMM");
    amm = await SimpleAMM.deploy(tokenA.target, tokenB.target);

    await tokenA.mint(user1.address, ethers.parseEther("1000"));
    await tokenB.mint(user1.address, ethers.parseEther("1000"));
    await tokenA.mint(user2.address, ethers.parseEther("1000"));
    await tokenB.mint(user2.address, ethers.parseEther("1000"));
    await tokenA.mint(user3.address, ethers.parseEther("1000"));
    await tokenB.mint(user3.address, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the correct token addresses", async function () {
      expect(await amm.tokenA()).to.equal(tokenA.target);
      expect(await amm.tokenB()).to.equal(tokenB.target);
    });

    it("Should start with zero reserves", async function () {
      expect(await amm.reserveA()).to.equal(0);
      expect(await amm.reserveB()).to.equal(0);
    });

    it("Should start with zero total liquidity", async function () {
      expect(await amm.totalLiquidity()).to.equal(0);
    });
  });

  describe("Deposit", function () {
    it("Should allow users to deposit tokens", async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.connect(user1).approve(amm.target, amountA);
      await tokenB.connect(user1).approve(amm.target, amountB);

      await amm.connect(user1).deposit(amountA, amountB);

      expect(await amm.reserveA()).to.equal(amountA);
      expect(await amm.reserveB()).to.equal(amountB);

      const expectedLiquidity = amountA + amountB;
      expect(await amm.liquidity(user1.address)).to.equal(expectedLiquidity);
      expect(await amm.totalLiquidity()).to.equal(expectedLiquidity);
    });

    it("Should fail with zero amounts", async function () {
      await expect(
        amm.connect(user1).deposit(0, ethers.parseEther("100"))
      ).to.be.revertedWith("Invalid amounts");

      await expect(
        amm.connect(user1).deposit(ethers.parseEther("100"), 0)
      ).to.be.revertedWith("Invalid amounts");

      await expect(amm.connect(user1).deposit(0, 0)).to.be.revertedWith(
        "Invalid amounts"
      );
    });

    it("Should transfer tokens from user to AMM", async function () {
      const amountA = ethers.parseEther("50");
      const amountB = ethers.parseEther("75");

      await tokenA.connect(user1).approve(amm.target, amountA);
      await tokenB.connect(user1).approve(amm.target, amountB);

      const tx = amm.connect(user1).deposit(amountA, amountB);
      await expect(tx).to.changeTokenBalances(
        tokenA,
        [user1, amm],
        [-amountA, amountA]
      );
      await expect(tx).to.changeTokenBalances(
        tokenB,
        [user1, amm],
        [-amountB, amountB]
      );
    });

    it("Should allow multiple users to deposit", async function () {
      const amountA1 = ethers.parseEther("100");
      const amountB1 = ethers.parseEther("200");
      const amountA2 = ethers.parseEther("50");
      const amountB2 = ethers.parseEther("100");

      await tokenA.connect(user1).approve(amm.target, amountA1);
      await tokenB.connect(user1).approve(amm.target, amountB1);
      await amm.connect(user1).deposit(amountA1, amountB1);

      await tokenA.connect(user2).approve(amm.target, amountA2);
      await tokenB.connect(user2).approve(amm.target, amountB2);
      await amm.connect(user2).deposit(amountA2, amountB2);

      expect(await amm.reserveA()).to.equal(amountA1 + amountA2);
      expect(await amm.reserveB()).to.equal(amountB1 + amountB2);

      expect(await amm.liquidity(user1.address)).to.equal(amountA1 + amountB1);
      expect(await amm.liquidity(user2.address)).to.equal(amountA2 + amountB2);
      expect(await amm.totalLiquidity()).to.equal(
        amountA1 + amountB1 + amountA2 + amountB2
      );
    });
  });

  describe("Redeem", function () {
    beforeEach(async function () {
      const amountA = ethers.parseEther("100");
      const amountB = ethers.parseEther("200");

      await tokenA.connect(user1).approve(amm.target, amountA);
      await tokenB.connect(user1).approve(amm.target, amountB);
      await amm.connect(user1).deposit(amountA, amountB);
    });

    it("Should allow users to redeem tokens", async function () {
      const redeemA = ethers.parseEther("20");
      const redeemB = ethers.parseEther("40");

      const totalLiquidity = await amm.totalLiquidity();
      const reserveA = await amm.reserveA();
      const reserveB = await amm.reserveB();
      const redeemAB =
        (redeemA * totalLiquidity) / reserveA +
        (redeemB * totalLiquidity) / reserveB;
      const expectedLiquidity = totalLiquidity - redeemAB;

      await amm.connect(user1).redeem(redeemA, redeemB);

      expect(await amm.reserveA()).to.equal(ethers.parseEther("80"));
      expect(await amm.reserveB()).to.equal(ethers.parseEther("160"));

      expect(await amm.liquidity(user1.address)).to.equal(expectedLiquidity);
      expect(await amm.totalLiquidity()).to.equal(expectedLiquidity);
    });

    it("Should fail with zero amounts", async function () {
      await expect(
        amm.connect(user1).redeem(0, ethers.parseEther("10"))
      ).to.be.revertedWith("Invalid redeem");

      await expect(
        amm.connect(user1).redeem(ethers.parseEther("10"), 0)
      ).to.be.revertedWith("Invalid redeem");

      await expect(amm.connect(user1).redeem(0, 0)).to.be.revertedWith(
        "Invalid redeem"
      );
    });

    it("Should fail with insufficient reserves", async function () {
      await expect(
        amm
          .connect(user1)
          .redeem(ethers.parseEther("150"), ethers.parseEther("50"))
      ).to.be.revertedWith("Insufficient reserves");

      await expect(
        amm
          .connect(user1)
          .redeem(ethers.parseEther("50"), ethers.parseEther("250"))
      ).to.be.revertedWith("Insufficient reserves");
    });

    it("Should fail with insufficient liquidity", async function () {
      await expect(
        amm
          .connect(user2)
          .redeem(ethers.parseEther("10"), ethers.parseEther("10"))
      ).to.be.revertedWith("Not enough liquidity");
    });

    it("Should transfer tokens back to user", async function () {
      const redeemA = ethers.parseEther("30");
      const redeemB = ethers.parseEther("60");

      const tx = amm.connect(user1).redeem(redeemA, redeemB);
      await expect(tx).to.changeTokenBalances(
        tokenA,
        [amm, user1],
        [-redeemA, redeemA]
      );
      await expect(tx).to.changeTokenBalances(
        tokenB,
        [amm, user1],
        [-redeemB, redeemB]
      );
    });
  });

  describe("Swap", function () {
    beforeEach(async function () {
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");

      await tokenA.connect(user1).approve(amm.target, amountA);
      await tokenB.connect(user1).approve(amm.target, amountB);
      await amm.connect(user1).deposit(amountA, amountB);
    });

    it("Should allow swapping tokenA for tokenB", async function () {
      const swapAmount = ethers.parseEther("100");
      const minAmountOut = ethers.parseEther("90");

      await tokenA.connect(user2).approve(amm.target, swapAmount);

      const balanceBefore = await tokenB.balanceOf(user2.address);
      await amm.connect(user2).swap(tokenA.target, swapAmount, minAmountOut);
      const balanceAfter = await tokenB.balanceOf(user2.address);

      const amountReceived = balanceAfter - balanceBefore;
      expect(amountReceived).to.be.gte(minAmountOut);

      expect(await amm.reserveA()).to.equal(ethers.parseEther("1100"));
      expect(await amm.reserveB()).to.be.lt(ethers.parseEther("1000"));
    });

    it("Should allow swapping tokenB for tokenA", async function () {
      const swapAmount = ethers.parseEther("100");
      const minAmountOut = ethers.parseEther("90");

      await tokenB.connect(user2).approve(amm.target, swapAmount);

      const balanceBefore = await tokenA.balanceOf(user2.address);
      await amm.connect(user2).swap(tokenB.target, swapAmount, minAmountOut);
      const balanceAfter = await tokenA.balanceOf(user2.address);

      const amountReceived = balanceAfter - balanceBefore;
      expect(amountReceived).to.be.gte(minAmountOut);

      expect(await amm.reserveB()).to.equal(ethers.parseEther("1100"));
      expect(await amm.reserveA()).to.be.lt(ethers.parseEther("1000"));
    });

    it("Should fail with zero input amount", async function () {
      await expect(
        amm.connect(user2).swap(tokenA.target, 0, ethers.parseEther("1"))
      ).to.be.revertedWith("Invalid input");
    });

    it("Should fail with invalid token", async function () {
      const invalidToken = user3.address;
      await expect(
        amm
          .connect(user2)
          .swap(invalidToken, ethers.parseEther("100"), ethers.parseEther("90"))
      ).to.be.revertedWith("Invalid token");
    });

    it("Should fail when slippage exceeded", async function () {
      const swapAmount = ethers.parseEther("100");
      const minAmountOut = ethers.parseEther("200");

      await tokenA.connect(user2).approve(amm.target, swapAmount);

      await expect(
        amm.connect(user2).swap(tokenA.target, swapAmount, minAmountOut)
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("Should apply 0.3% fee correctly", async function () {
      const swapAmount = ethers.parseEther("100");
      const minAmountOut = 0;

      await tokenA.connect(user2).approve(amm.target, swapAmount);

      const amountInWithFee = swapAmount * 997n;
      const numerator = amountInWithFee * ethers.parseEther("1000");
      const denominator = ethers.parseEther("1000") * 1000n + amountInWithFee;
      const expectedOutput = numerator / denominator;

      const balanceBefore = await tokenB.balanceOf(user2.address);
      await amm.connect(user2).swap(tokenA.target, swapAmount, minAmountOut);
      const balanceAfter = await tokenB.balanceOf(user2.address);

      const actualOutput = balanceAfter - balanceBefore;
      expect(actualOutput).to.equal(expectedOutput);
    });

    it("Should handle large swaps correctly", async function () {
      const swapAmount = ethers.parseEther("500");
      const reserveA = await amm.reserveA();
      const reserveB = await amm.reserveB();
      const amountInWithFee = swapAmount * 997n;
      const numerator = amountInWithFee * reserveB;
      const denominator = reserveA * 1000n + amountInWithFee;
      const expectedOutput = numerator / denominator;
      const minAmountOut = expectedOutput;

      await tokenA.connect(user2).approve(amm.target, swapAmount);

      await expect(
        amm.connect(user2).swap(tokenA.target, swapAmount, minAmountOut)
      ).to.not.be.reverted;

      expect(await amm.reserveA()).to.equal(reserveA + swapAmount);
      expect(await amm.reserveB()).to.be.lt(reserveB);
    });

    it("Should update reserves correctly when swapping tokenB for tokenA", async function () {
      const swapAmount = ethers.parseEther("200");

      const reserveA = await amm.reserveA();
      const reserveB = await amm.reserveB();
      const amountInWithFee = swapAmount * 997n;
      const numerator = amountInWithFee * reserveA;
      const denominator = reserveB * 1000n + amountInWithFee;
      const expectedOutput = numerator / denominator;
      const minAmountOut = expectedOutput;

      await tokenB.connect(user2).approve(amm.target, swapAmount);

      const reserveABefore = await amm.reserveA();
      const reserveBBefore = await amm.reserveB();

      await amm.connect(user2).swap(tokenB.target, swapAmount, minAmountOut);

      expect(await amm.reserveB()).to.equal(reserveBBefore + swapAmount);
      expect(await amm.reserveA()).to.be.lt(reserveABefore);
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete AMM lifecycle", async function () {
      const depositA = ethers.parseEther("1000");
      const depositB = ethers.parseEther("1000");

      await tokenA.connect(user1).approve(amm.target, depositA);
      await tokenB.connect(user1).approve(amm.target, depositB);
      await amm.connect(user1).deposit(depositA, depositB);

      const swapAmount1 = ethers.parseEther("100");
      await tokenA.connect(user2).approve(amm.target, swapAmount1);
      await amm
        .connect(user2)
        .swap(tokenA.target, swapAmount1, ethers.parseEther("90"));

      const swapAmount2 = ethers.parseEther("50");
      await tokenB.connect(user3).approve(amm.target, swapAmount2);
      await amm
        .connect(user3)
        .swap(tokenB.target, swapAmount2, ethers.parseEther("45"));

      const redeemA = ethers.parseEther("200");
      const redeemB = ethers.parseEther("200");
      await amm.connect(user1).redeem(redeemA, redeemB);

      expect(await amm.reserveA()).to.be.gt(0);
      expect(await amm.reserveB()).to.be.gt(0);
      expect(await amm.totalLiquidity()).to.be.gt(0);
    });
  });
});

describe("MockERC20", function () {
  let MockERC20, token, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    token = await MockERC20Factory.deploy("Test Token", "TEST");
  });

  it("Should mint tokens correctly", async function () {
    const amount = ethers.parseEther("1000");
    await token.mint(user1.address, amount);
    expect(await token.balanceOf(user1.address)).to.equal(amount);
  });

  it("Should transfer tokens correctly", async function () {
    const amount = ethers.parseEther("100");
    await token.mint(user1.address, amount);
    await token.connect(user1).transfer(user2.address, amount);
    expect(await token.balanceOf(user2.address)).to.equal(amount);
  });

  it("Should handle approvals correctly", async function () {
    const amount = ethers.parseEther("100");
    await token.connect(user1).approve(user2.address, amount);
    expect(await token.allowance(user1.address, user2.address)).to.equal(
      amount
    );
  });
});
