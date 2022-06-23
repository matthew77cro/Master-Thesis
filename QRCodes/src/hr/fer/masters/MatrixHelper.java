package hr.fer.masters;

public class MatrixHelper {

    public static int determinant(GaloisField GF, int[][] matrix) {
        if(matrix.length != matrix[0].length)
            throw new RuntimeException("Not a square matrix");

        if(matrix.length == 2) {
            return GF.toIntegerRepresentation(GF.subtract(
                    GF.multiply(
                            GF.toPolynomialRepresentation(matrix[0][0]),
                            GF.toPolynomialRepresentation(matrix[1][1])
                    ),
                    GF.multiply(
                            GF.toPolynomialRepresentation(matrix[0][1]),
                            GF.toPolynomialRepresentation(matrix[1][0])
                    )
            ));
        } else if(matrix.length == 1) {
            return matrix[0][0];
        }

        int determinant = 0;
        for(int i = 0; i < matrix.length; i++) {
            int[][] newMatrix = new int[matrix.length - 1][matrix.length - 1];
            for(int a = 0; a < matrix.length; a++) {
                for(int b = 0, pointerColumn = 0; b < matrix.length; b++, pointerColumn++) {
                    if (pointerColumn == i)
                        pointerColumn++;

                    newMatrix[a][b] = matrix[a + 1][pointerColumn];
                }
            }

            determinant = GF.toIntegerRepresentation(GF.add(
                    GF.toPolynomialRepresentation(determinant),
                    GF.multiply(
                            GF.toPolynomialRepresentation(matrix[0][i]),
                            GF.toPolynomialRepresentation(determinant(GF, newMatrix))
                    )
            ));
        }

        return determinant;
    }

    // Ax = b
    public static int[] solveLinearSystem(GaloisField GF, int[][] a, int[] b) {
        if(a.length != a[0].length)
            throw new RuntimeException("Not a square matrix");

        int[] solutions = new int[a.length];

        int detA = determinant(GF, a);
        for (int i = 0; i < a.length; i++) {
            int[][] newA = new int[a.length][a.length];

            for (int j = 0; j < a.length; j++) {
                for (int k = 0; k < a.length; k++) {
                    newA[j][k] = k == i ? b[j] : a[j][k];
                }
            }

            int detNewA = determinant(GF, newA);
            solutions[i] = GF.toIntegerRepresentation(GF.divide(GF.toPolynomialRepresentation(detNewA), GF.toPolynomialRepresentation(detA)));
        }

        return solutions;
    }

}
