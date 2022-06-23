package hr.fer.masters;

import java.util.Scanner;

public class Main {

    // 0100000001110101000101010010001011010100001101101111011001000110010100000001011101011110110001101010100100000000101100110010001110001001010001100001100010111110110101101100010110100101000111000110100100011100
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String QRBits = sc.nextLine();
        sc.close();

        if(!QRBits.startsWith("0100") || QRBits.length()/8 != 26) {
            System.out.println("Not in byte format or not version 1");
        }

        int dataLen = 2;
        int pow2 = 1;
        for (int i = 7; i >= 0; i--) {
            if(QRBits.charAt(i + 4) == '1')
                dataLen += pow2;
            pow2 *= 2;
        }

        int len = QRBits.length() / 8;

        int[] msgCoefficients = new int[len];
        int QRPointer = 0;
        for (int i = len - 1; i >= 0; i--) {
            int[] coefficients = new int[8];
            for (int j = coefficients.length - 1; j >= 0; j--, QRPointer++) {
                if(QRBits.charAt(QRPointer) == '1')
                    coefficients[j] = 1;
            }

            msgCoefficients[i] = GaloisField.GF256.toIntegerRepresentation(new Polynomial(coefficients));
        }

        MessagePolynomial received = new MessagePolynomial(GaloisField.GF256, msgCoefficients);
        MessagePolynomial corrected = ReedSolomonDecoding.errorCorrection(GaloisField.GF256, received, len - dataLen, 0);

        int[] messageBits = new int[dataLen * 8];
        for (int i = 0; i < dataLen; i++) {
            Polynomial poly = GaloisField.GF256.toPolynomialRepresentation(corrected.getCoefficient(len - 1 - i));
            for (int j = poly.getDegree(); j >= 0; j--) {
                messageBits[i * 8 + (7 - j)] = poly.getCoefficient(j);
            }
        }

        StringBuilder sb = new StringBuilder();
        int messageBitsPointer = 12;
        for (int i = 0; i < dataLen - 2; i++) {
            int asciiCode = 0;
            pow2 = 128;
            for (int j = 0; j < 8; j++, messageBitsPointer++) {
                asciiCode += pow2 * messageBits[messageBitsPointer];
                pow2 /= 2;
            }

            sb.append(Character.toString((char)asciiCode));
        }

        System.out.println(sb.toString());
    }
}
