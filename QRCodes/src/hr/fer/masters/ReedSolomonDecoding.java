package hr.fer.masters;

import java.util.ArrayList;
import java.util.List;

public class ReedSolomonDecoding {
    // starting power usually 1 but 0 for QR codes
    // parity check symbols = 2t = n - k
    // FCR - first consecutive root - usually = 1, but = 0 for QR codes
    public static MessagePolynomial calculateGeneratorPolynomial(GaloisField GF, int parityCheckSymbols, int FCR) {
        int alpha = GF.toIntegerRepresentation(
                GF.subtract(
                        Polynomial.ZERO,
                        GF.toPolynomialRepresentation(GF.toIntegerRepresentation(FCR))
                )
        );
        MessagePolynomial generator = new MessagePolynomial(GF, alpha, 1, 0);

        for(int i = FCR + 1; i < parityCheckSymbols + FCR; i++) {
            alpha = GF.toIntegerRepresentation(
                    GF.subtract(
                            Polynomial.ZERO,
                            GF.toPolynomialRepresentation(GF.toIntegerRepresentation(i))
                    )
            );

            generator = MessagePolynomial.multiply(generator, new MessagePolynomial(GF, alpha, 1, 0));
        }

        return generator;
    }

    // n - k = 2t = parityCheckSymbols
    public static MessagePolynomial errorCorrection(GaloisField GF, MessagePolynomial receivedCodeword, int parityCheckSymbols, int FCR) {
        // Step 1 : Calculate syndromes as R(alpha^i) for i = 0, ..., parityCheckSymbols-1
        int[] syndromes = new int[parityCheckSymbols];
        boolean allZero = true;
        for(int i = FCR; i < parityCheckSymbols + FCR; i++) {
            int test = GF.toIntegerRepresentation(i);
            syndromes[i - FCR] = receivedCodeword.evaluate(GF.toIntegerRepresentation(i));
            if (syndromes[i - FCR] != 0)
                allZero = false;
        }

        if(allZero)
            return receivedCodeword;

        // Step 2 : Error locator polynomial

        // start at myu = -1 for index 0 in these lists
        List<MessagePolynomial> omega = new ArrayList<>();
        List <Integer> dmyu = new ArrayList<>();
        List <Integer> hmyu = new ArrayList<>();

        omega.add(new MessagePolynomial(GF, new int[]{1}));
        dmyu.add(1);
        hmyu.add(0);

        omega.add(new MessagePolynomial(GF, new int[]{1}));
        dmyu.add(syndromes[0]);
        hmyu.add(0);

        for (int myu = 0; myu < parityCheckSymbols; myu++) {
            MessagePolynomial newOmega;
            int newDmyu = 0, newHmyu = 0;

            if (dmyu.get(myu + 1) == 0) {
                newOmega = omega.get(myu + 1);
                newHmyu = hmyu.get(myu + 1);
            } else {
                int maxRo = myu - 1;
                int maxVal = Integer.MIN_VALUE;

                for (int ro = myu - 1; ro >= -1; ro--) {
                    if (dmyu.get(ro + 1) == 0)
                        continue;

                    int newVal = ro - hmyu.get(ro + 1);
                    if (maxVal < newVal) {
                        maxRo = ro;
                        maxVal = newVal;
                    }
                }

                newOmega = MessagePolynomial.add(
                        omega.get(myu + 1),
                        MessagePolynomial.multiply(
                                new MessagePolynomial(GF,
                                        GF.toIntegerRepresentation(GF.multiply(
                                                GF.toPolynomialRepresentation(dmyu.get(myu + 1)),
                                                GF.inverse(GF.toPolynomialRepresentation(dmyu.get(maxRo + 1)))
                                        )),
                                        myu-maxRo),
                                omega.get(maxRo + 1)
                        )
                );

                newHmyu = Math.max(hmyu.get(myu + 1), hmyu.get(maxRo + 1) + myu - maxRo);
                int a = 5;
            }

            if (myu < parityCheckSymbols - 1) {
                newDmyu = syndromes[myu + 2 - 1];
                for (int i = 0; i < newHmyu; i++) {
                    newDmyu = GF.toIntegerRepresentation(GF.add(
                            GF.toPolynomialRepresentation(newDmyu),
                            GF.multiply(
                                    GF.toPolynomialRepresentation(newOmega.getCoefficient(i + 1)),
                                    GF.toPolynomialRepresentation(syndromes[myu + 1 - 1 - i])
                            )
                    ));
                }
            }

            omega.add(newOmega);
            dmyu.add(newDmyu);
            hmyu.add(newHmyu);
        }

        int[] omegaRCoefficients = new int[omega.get(omega.size() - 1).getDegree() + 1];
        for (int i = 0; i < omegaRCoefficients.length; i++) {
            omegaRCoefficients[i] = omega.get(omega.size() - 1).getCoefficient(omegaRCoefficients.length - 1 - i);
        }

        MessagePolynomial omegaR = new MessagePolynomial(GF, omegaRCoefficients);

        // Step 3: Find error locations zi
        List<Integer> zis = new ArrayList<>();
        for(int i = 0; i < (int)(Math.pow(GF.getP(), GF.getN())); i++) {
            int pointOfEval = GF.toIntegerRepresentation(i);
            int eval = omegaR.evaluate(pointOfEval);

            if (eval == 0)
                zis.add(pointOfEval);

            if (zis.size() == omegaR.getDegree())
                break;
        }

        List<Integer> zisAsAlphaPower = new ArrayList<>();
        for(int zi : zis) {
            zisAsAlphaPower.add(GF.toPowerRepresentation(zi));
        }

        // Step 4: Find error values for positions
        int[][] matrixA = new int[zis.size()][zis.size()];
        int[] vectorB = new int[zis.size()];
        for (int i = 0; i < zis.size(); i++) {
            for (int j = 0; j < zis.size(); j++) {
                matrixA[i][j] = GF.toIntegerRepresentation(zisAsAlphaPower.get(j) * (i + 1));
            }

            vectorB[i] = syndromes[i];
        }

        int[] errorValues = MatrixHelper.solveLinearSystem(GF, matrixA, vectorB);

        // Step 5: Correct the errors
        int[] messageCoefficients = new int[receivedCodeword.getDegree() + 1];
        int zisPointer = 0;
        for (int i = 0; i < messageCoefficients.length; i++) {
            if (zisPointer < zis.size() && i == zisAsAlphaPower.get(zisPointer)) {
                messageCoefficients[i] = GF.toIntegerRepresentation(GF.add(
                        GF.toPolynomialRepresentation(receivedCodeword.getCoefficient(i)),
                        GF.toPolynomialRepresentation(errorValues[zisPointer])
                ));
                zisPointer++;
                continue;
            }

            messageCoefficients[i] = receivedCodeword.getCoefficient(i);
        }

        return new MessagePolynomial(GF, messageCoefficients);
    }

}
