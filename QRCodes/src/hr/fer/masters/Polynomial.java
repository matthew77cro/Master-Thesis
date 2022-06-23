package hr.fer.masters;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class Polynomial {

    public static final Polynomial QRCodePrimitive = new Polynomial(1, 0, 1, 1, 1, 0, 0, 0, 1); // x8 + x4 + x3 + x2 + 1
    public static final Polynomial ZERO = new Polynomial(new int[]{0});
    public static final Polynomial ONE = new Polynomial(new int[]{1});

    private List<Integer> coefficients;

    public Polynomial(int... coef) {
        this.coefficients = new ArrayList<>();
        for (int i : coef) {
            coefficients.add(i);
        }
        this.trim();
    }

    public Polynomial(Polynomial p) {
        this.coefficients = new ArrayList<>(p.coefficients);
    }

    // Creates a monomial
    public Polynomial(int coefficient, int degree) {
        this.coefficients = new ArrayList<>();
        for (int i = 0; i < degree; i++) {
            coefficients.add(0);
        }
        coefficients.add(coefficient);
    }

    public int getDegree() {
        return coefficients.size() - 1;
    }

    public int getCoefficient(int power) {
        return coefficients.get(power);
    }

    private Polynomial trim() {
        while(coefficients.size() > 1 && coefficients.get(getDegree()) == 0) {
            coefficients.remove(getDegree());
        }
        return this;
    }

    public int evaluate(int value) {
        int eval = 0;

        for (int i = 0; i < coefficients.size(); i++) {
            eval += coefficients.get(i) * (int)(Math.pow(value, i));
        }

        return eval;
    }

    public static Polynomial add(Polynomial p1, Polynomial p2) {
        int p1Deg = p1.getDegree();
        int p2Deg = p2.getDegree();

        int degree = Math.max(p1Deg, p2Deg);
        int[] coef = new int[degree + 1];

        for (int i = 0; i < coef.length; i++) {
            int a = p1Deg < i ? 0 : p1.getCoefficient(i);
            int b = p2Deg < i ? 0 : p2.getCoefficient(i);
            coef[i] = a + b;
        }

        return (new Polynomial(coef)).trim();
    }

    public static Polynomial subtract(Polynomial p1, Polynomial p2) {
        int p1Deg = p1.getDegree();
        int p2Deg = p2.getDegree();

        int degree = Math.max(p1Deg, p2Deg);
        int[] coef = new int[degree + 1];

        for (int i = 0; i < coef.length; i++) {
            int a = p1Deg < i ? 0 : p1.getCoefficient(i);
            int b = p2Deg < i ? 0 : p2.getCoefficient(i);
            coef[i] = a - b;
        }

        return (new Polynomial(coef)).trim();
    }

    public static Polynomial multiply(Polynomial p1, Polynomial p2) {
        int p1Deg = p1.getDegree();
        int p2Deg = p2.getDegree();

        int degree = p1Deg + p2Deg;
        int[] coef = new int[degree + 1];

        for (int i = 0; i <= p1Deg; i++) {
            for (int j = 0; j <= p2Deg; j++) {
                coef[i + j] += p1.coefficients.get(i) * p2.coefficients.get(j);
            }
        }

        return (new Polynomial(coef)).trim();
    }

    public static DivisionResult divide(Polynomial p1, Polynomial p2) {
        Polynomial tmp1 = new Polynomial(p1);
        Polynomial tmp2;
        int leadCoefP2 = p2.coefficients.get(p2.coefficients.size() - 1);

        int resultDegree = p1.getDegree() - p2.getDegree();
        resultDegree = resultDegree < 0 ? 0 : resultDegree;
        int[] result = new int[resultDegree + 1];

        while (tmp1.getDegree() >= p2.getDegree() && !tmp1.equals(ZERO)) {
            int leadCoefTmp1 = tmp1.coefficients.get(tmp1.coefficients.size() - 1);

            int resultMemberDegree = tmp1.getDegree() - p2.getDegree();
            int resultMemberCoef = leadCoefTmp1 / leadCoefP2;

            Polynomial monomialResultMember = new Polynomial(resultMemberCoef, resultMemberDegree);
            result[resultMemberDegree] = resultMemberCoef;
            tmp2 = Polynomial.multiply(p2, monomialResultMember);
            tmp1 = Polynomial.subtract(tmp1, tmp2);
        }

        return new DivisionResult(new Polynomial(result), tmp1);
    }

    public static class DivisionResult {
        private Polynomial result;
        private Polynomial remainder;

        public DivisionResult(Polynomial result, Polynomial remainder) {
            this.result = result;
            this.remainder = remainder;
        }

        public Polynomial getResult() {
            return result;
        }

        public Polynomial getRemainder() {
            return remainder;
        }

        @Override
        public String toString() {
            return "DivisionResult{" +
                    "result=" + result +
                    ", remainder=" + remainder +
                    '}';
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Polynomial)) return false;
        Polynomial that = (Polynomial) o;
        return coefficients.equals(that.coefficients);
    }

    @Override
    public int hashCode() {
        return Objects.hash(coefficients);
    }

    @Override
    public String toString() {
        return "Polynomial{" +
                "coefficients=" + coefficients +
                '}';
    }
}
