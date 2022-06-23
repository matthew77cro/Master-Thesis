package hr.fer.masters;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

// Polynomial whose coefficients are in GF(q=p^n)
public class MessagePolynomial {

    private GaloisField GF;
    private List<Integer> integerCoefficients;

    public MessagePolynomial(GaloisField GF, int... integerCoefficients) {
        this.GF = GF;
        this.integerCoefficients = new ArrayList<>();
        for (int i : integerCoefficients) {
            this.integerCoefficients.add(i);
        }
        this.trim();
    }

    public MessagePolynomial(MessagePolynomial p) {
        this.GF = p.GF;
        this.integerCoefficients = new ArrayList<>(p.integerCoefficients);
    }

    // Creates a monomial
    public MessagePolynomial(GaloisField GF, int coefficient, int degree) {
        this.GF = GF;

        this.integerCoefficients = new ArrayList<>();
        for (int i = 0; i < degree; i++) {
            integerCoefficients.add(0);
        }
        integerCoefficients.add(coefficient);
    }

    public int getDegree() {
        return integerCoefficients.size() - 1;
    }

    public int getCoefficient(int power) {
        return integerCoefficients.get(power);
    }

    public GaloisField getGaloisField() {
        return this.GF;
    }

    private MessagePolynomial trim() {
        while(integerCoefficients.size() > 1 && integerCoefficients.get(getDegree()) == 0) {
            integerCoefficients.remove(getDegree());
        }
        return this;
    }

    public int evaluate(int value) {
        int valueAsAlphaPower = GF.toPowerRepresentation(value);

        int eval = 0;

        for (int i = 0; i < integerCoefficients.size(); i++) {
            eval = GF.toIntegerRepresentation(GF.add(
                    GF.toPolynomialRepresentation(eval),
                    GF.multiply(
                            GF.toPolynomialRepresentation(integerCoefficients.get(i)),
                            GF.toPolynomialRepresentation(GF.toIntegerRepresentation(valueAsAlphaPower * i))
                    )
            ));
        }

        return eval;
    }

    public static MessagePolynomial add(MessagePolynomial p1, MessagePolynomial p2) {
        if (!p1.GF.equals(p2.GF))
            throw new RuntimeException("Not compatible");

        int p1Deg = p1.getDegree();
        int p2Deg = p2.getDegree();

        int degree = Math.max(p1Deg, p2Deg);
        int[] coef = new int[degree + 1];

        for (int i = 0; i < coef.length; i++) {
            int a = p1Deg < i ? 0 : p1.getCoefficient(i);
            int b = p2Deg < i ? 0 : p2.getCoefficient(i);
            coef[i] = p1.GF.toIntegerRepresentation(
                    p1.GF.add(
                            p1.GF.toPolynomialRepresentation(a),
                            p1.GF.toPolynomialRepresentation(b)
                    )
            );
        }

        return (new MessagePolynomial(p1.GF, coef)).trim();
    }

    public static MessagePolynomial subtract(MessagePolynomial p1, MessagePolynomial p2) {
        if (!p1.GF.equals(p2.GF))
            throw new RuntimeException("Not compatible");

        int p1Deg = p1.getDegree();
        int p2Deg = p2.getDegree();

        int degree = Math.max(p1Deg, p2Deg);
        int[] coef = new int[degree + 1];

        for (int i = 0; i < coef.length; i++) {
            int a = p1Deg < i ? 0 : p1.getCoefficient(i);
            int b = p2Deg < i ? 0 : p2.getCoefficient(i);
            coef[i] = p1.GF.toIntegerRepresentation(
                    p1.GF.subtract(
                            p1.GF.toPolynomialRepresentation(a),
                            p1.GF.toPolynomialRepresentation(b)
                    )
            );
        }

        return (new MessagePolynomial(p1.GF, coef)).trim();
    }

    public static MessagePolynomial multiply(MessagePolynomial p1, MessagePolynomial p2) {
        if (!p1.GF.equals(p2.GF))
            throw new RuntimeException("Not compatible");

        int p1Deg = p1.getDegree();
        int p2Deg = p2.getDegree();

        int degree = p1Deg + p2Deg;
        int[] coef = new int[degree + 1];

        for (int i = 0; i <= p1Deg; i++) {
            for (int j = 0; j <= p2Deg; j++) {
                int product = p1.GF.toIntegerRepresentation(
                        p1.GF.multiply(
                                p1.GF.toPolynomialRepresentation(p1.integerCoefficients.get(i)),
                                p1.GF.toPolynomialRepresentation(p2.integerCoefficients.get(j))
                        )
                );

                coef[i + j] = p1.GF.toIntegerRepresentation(
                        p1.GF.add(
                                p1.GF.toPolynomialRepresentation(coef[i + j]),
                                p1.GF.toPolynomialRepresentation(product)
                        )
                );
            }
        }

        return (new MessagePolynomial(p1.GF, coef)).trim();
    }

    public static DivisionResult divide(MessagePolynomial p1, MessagePolynomial p2) {
        if (!p1.GF.equals(p2.GF))
            throw new RuntimeException("Not compatible");

        MessagePolynomial tmp1 = new MessagePolynomial(p1);
        MessagePolynomial tmp2;
        int leadCoefP2 = p2.integerCoefficients.get(p2.integerCoefficients.size() - 1);

        int resultDegree = p1.getDegree() - p2.getDegree();
        resultDegree = resultDegree < 0 ? 0 : resultDegree;
        int[] result = new int[resultDegree + 1];

        while (tmp1.getDegree() >= p2.getDegree()) {
            int leadCoefTmp1 = tmp1.integerCoefficients.get(tmp1.integerCoefficients.size() - 1);

            int resultMemberDegree = tmp1.getDegree() - p2.getDegree();
            int resultMemberCoef = p1.GF.toIntegerRepresentation(p1.GF.divide(p1.GF.toPolynomialRepresentation(leadCoefTmp1), p1.GF.toPolynomialRepresentation(leadCoefP2)));

            MessagePolynomial monomialResultMember = new MessagePolynomial(p1.GF, resultMemberCoef, resultMemberDegree);
            result[resultMemberDegree] = resultMemberCoef;
            tmp2 = MessagePolynomial.multiply(p2, monomialResultMember);
            tmp1 = MessagePolynomial.subtract(tmp1, tmp2);
        }

        return new DivisionResult(new MessagePolynomial(p1.GF, result), tmp1);
    }

    public static class DivisionResult {
        private MessagePolynomial result;
        private MessagePolynomial remainder;

        public DivisionResult(MessagePolynomial result, MessagePolynomial remainder) {
            this.result = result;
            this.remainder = remainder;
        }

        public MessagePolynomial getResult() {
            return result;
        }

        public MessagePolynomial getRemainder() {
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
        if (!(o instanceof MessagePolynomial)) return false;
        MessagePolynomial that = (MessagePolynomial) o;
        return Objects.equals(GF, that.GF) && Objects.equals(integerCoefficients, that.integerCoefficients);
    }

    @Override
    public int hashCode() {
        return Objects.hash(GF, integerCoefficients);
    }

    @Override
    public String toString() {
        return "MessagePolynomial{" +
                "GF=" + GF +
                ", integerCoefficients=" + integerCoefficients +
                '}';
    }
}
