package hr.fer.masters;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;

public class GaloisField {

    public static final GaloisField GF256 = new GaloisField(Polynomial.QRCodePrimitive, 2, 8);

    private Polynomial primitivePolynomial;
    private int p;
    private int n;

    // Log-antilog table
    private HashMap<Integer, Integer> powerToIntegerTable;
    private HashMap<Integer, Integer> integerToPowerTable;

    private int primitivePolynomialInt;

    // GF(q) where q = p^n; p must be a prime number for this to make sense
    public GaloisField(Polynomial primitivePolynomial, int p, int n) {
        this.primitivePolynomial = primitivePolynomial;
        this.p = p;
        this.n = n;

        powerToIntegerTable = new HashMap<>();
        integerToPowerTable = new HashMap<>();

        generateLogAntilogTable();

        this.primitivePolynomialInt = this.toIntegerRepresentation(primitivePolynomial);
    }

    private void generateLogAntilogTable() {
        Polynomial poly = new Polynomial(new int[]{1});
        Polynomial alpha = new Polynomial(new int[]{0, 1});

        int intPoly = this.toIntegerRepresentation(poly);
        powerToIntegerTable.put(0, intPoly);
        integerToPowerTable.put(intPoly, 0);

        for (int i = 1; i < Math.pow(p, n) - 1; i++) {
            poly = this.multiply(poly, alpha);

            intPoly = this.toIntegerRepresentation(poly);
            powerToIntegerTable.put(i, intPoly);
            integerToPowerTable.put(intPoly, i);
        }
    }

    private Polynomial moduloCoef(Polynomial poly) {
        int[] poly2 = new int[poly.getDegree() + 1];
        for (int i = 0; i <= poly.getDegree(); i++) {
            poly2[i] = poly.getCoefficient(i) % p;
            if (poly2[i] < 0)
                poly2[i] += p;
        }
        return new Polynomial(poly2);
    }

    public int getP() {
        return p;
    }

    public int getN() {
        return n;
    }

    public Polynomial getPrimitivePolynomial() {
        return primitivePolynomial;
    }

    public int getPrimitivePolynomialInt() {
        return primitivePolynomialInt;
    }

    public Polynomial add(Polynomial p1, Polynomial p2) {
        return moduloCoef(Polynomial.add(p1, p2));
    }

    public Polynomial subtract(Polynomial p1, Polynomial p2) {
        return moduloCoef(Polynomial.subtract(p1, p2));
    }

    public Polynomial multiply(Polynomial p1, Polynomial p2) {
        return moduloCoef(Polynomial.divide(Polynomial.multiply(p1, p2), primitivePolynomial).getRemainder());
    }

    public Polynomial inverse(Polynomial p1) {
        Polynomial t = new Polynomial(new int[] {0});
        Polynomial newt = new Polynomial(new int[] {1});
        Polynomial r = this.primitivePolynomial;
        Polynomial newr = p1;

        while(!newr.equals(Polynomial.ZERO)) {
            Polynomial quotient = moduloCoef(Polynomial.divide(r, newr).getResult());

            Polynomial oldR = r;
            r = newr;
            newr = moduloCoef(Polynomial.subtract(oldR, Polynomial.multiply(quotient, newr)));

            Polynomial oldT = t;
            t = newt;
            newt = moduloCoef(Polynomial.subtract(oldT, Polynomial.multiply(quotient, newt)));
        }

        Polynomial result = Polynomial.multiply(Polynomial.divide(Polynomial.ONE, r).getResult(), t);
        return moduloCoef(Polynomial.divide(result, primitivePolynomial).getRemainder());
    }

    public Polynomial divide(Polynomial p1, Polynomial p2) {
        return moduloCoef(Polynomial.divide(this.multiply(p1, this.inverse(p2)), primitivePolynomial).getRemainder());
    }

    public int toIntegerRepresentation(Polynomial poly) {
        int a = 0;
        int pPower = 1;
        for(int i = 0; i <= poly.getDegree(); i++) {
            a += poly.getCoefficient(i) * pPower;
            pPower *= p;
        }
        return a;
    }

    public Polynomial toPolynomialRepresentation(int integer) {
        List<Integer> coefficients = new ArrayList<>();

        while (integer >= this.p) {
            coefficients.add(integer % this.p);
            integer /= this.p;
        }
        coefficients.add(integer);

        int[] coefficientsArray = new int[coefficients.size()];
        int i = 0;
        for(int c : coefficients)
            coefficientsArray[i++] = c;

        return new Polynomial(coefficientsArray);
    }

    public int toIntegerRepresentation(int powerOfAlpha) {
        return powerToIntegerTable.get(powerOfAlpha % (int)(Math.pow(p, n) - 1));
    }

    public int toPowerRepresentation(int integer) {
        return integerToPowerTable.get(integer);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof GaloisField)) return false;
        GaloisField that = (GaloisField) o;
        return p == that.p && n == that.n && primitivePolynomial.equals(that.primitivePolynomial);
    }

    @Override
    public int hashCode() {
        return Objects.hash(primitivePolynomial, p, n);
    }

    @Override
    public String toString() {
        return "GaloisField{" + "\n" +
                "primitivePolynomial=" + primitivePolynomial + "\n" +
                ", p=" + p + "\n" +
                ", n=" + n + "\n" +
                ", powerToIntegerTable=" + powerToIntegerTable + "\n" +
                ", integerToPowerTable=" + integerToPowerTable + "\n" +
                ", primitivePolynomialInt=" + primitivePolynomialInt + "\n" +
                '}';
    }
}
